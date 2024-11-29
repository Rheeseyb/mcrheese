import {CategoryAndSubCategoriesDetailPageStyle} from '../components/CategoryAndSubCategories';
import {CATEGORIES_METAOBJECT_QUERY, processCategory} from '../lib/categories';

import {
  Await,
  ClientLoaderFunctionArgs,
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
  useSubmit,
  type MetaFunction,
} from '@remix-run/react';
import type {Storefront} from '@shopify/hydrogen';
import {
  Analytics,
  getPaginationVariables,
  Image,
  Money,
} from '@shopify/hydrogen';
import {defer, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import React, {Suspense} from 'react';
import type {
  CollectionQuery,
  ProductItemFragment,
} from 'storefrontapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {useVariantUrl} from '~/lib/variants';
import {NavigationSidebar} from '../components/NavigationSidebar';
import {AddToCartButton} from '../components/AddToCartButton';

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return defer({...deferredData, ...criticalData});
}

export async function clientLoader({
  request,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  // During client-side navigations, we hit our exposed API endpoints directly
  return serverLoader();
}
clientLoader.hydrate = true;

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const {handle} = params;

  if (!handle) {
    throw redirect('/');
  }

  const [{category}, {category: rootCategory}] = await Promise.all([
    context.storefront.query(CATEGORIES_METAOBJECT_QUERY, {
      variables: {
        handle: handle!,
      },
    }),
    context.storefront.query(CATEGORIES_METAOBJECT_QUERY, {
      variables: {
        handle: 'hardware',
      },
    }),
  ]);

  if (!category || !rootCategory) {
    throw new Response(`Category ${handle} not found`, {
      status: 404,
    });
  }

  const processedCategory = processCategory(category);

  const entireCollection = await loadCollection(
    processedCategory.collectionHandle!,
    context.storefront,
    request,
  );

  const allProducts = entireCollection.collection?.products.nodes || [];

  const productOptions = buildProductOptionsFromProducts(allProducts);

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const selectedFilters = buildSelectedFiltersFromSearchParams(searchParams);
  const selectedFilterOptionNames = Object.keys(selectedFilters);

  const filteredProducts = filterProductsBySelectedOptions(
    allProducts,
    selectedFilterOptionNames,
    selectedFilters,
  );

  // Update the collection products with filtered results
  if (entireCollection.collection) {
    entireCollection.collection.products.nodes = filteredProducts;
  }

  return {
    selectedCategory: processedCategory,
    topLevelCategories: processCategory(rootCategory).subCategories,
    // BB NOTE: making this awaited does not seem to significantly affect performance
    collectionPromise: entireCollection,
    productOptions,
    selectedFilters,
  };
}

function buildSelectedFiltersFromSearchParams(
  searchParams: URLSearchParams,
): Record<string, string[]> {
  // Build selectedFilters from URL search params
  const selectedFilters: Record<string, Set<string>> = {};
  for (const [name, value] of searchParams) {
    if (!selectedFilters[name]) {
      selectedFilters[name] = new Set();
    }
    selectedFilters[name].add(value);
  }

  // Convert selectedFilters to a JSON-serializable object
  const selectedFiltersObject: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(selectedFilters)) {
    selectedFiltersObject[name] = Array.from(values);
  }

  return selectedFiltersObject;
}

function buildProductOptionsFromProducts(
  allProducts: ProductItemFragment[],
): Record<string, string[]> {
  const optionValues = new Map<string, Set<string>>();
  allProducts.forEach((product) => {
    product.variants.nodes.forEach((variant) =>
      variant.selectedOptions.forEach((option, index) => {
        const optionName = product.options[index].name;
        if (!optionValues.has(optionName)) {
          optionValues.set(optionName, new Set());
        }
        optionValues.get(optionName)?.add(option.value);
      }),
    );
  });

  // turning optionValues into a stringifiable object
  const productOptions: Record<string, string[]> = {};
  for (const [optionName, values] of optionValues) {
    productOptions[optionName] = Array.from(values);
  }

  return productOptions;
}

function filterProductsBySelectedOptions(
  products: ProductItemFragment[],
  selectedFilterOptionNames: string[],
  selectedFilters: Record<string, string[]>,
) {
  return products
    .map((product) => {
      // if there are no selected filters, include all products
      if (selectedFilterOptionNames.length === 0) {
        return product;
      }

      // if there is a selected filter that the product does not have, exclude it
      if (
        !selectedFilterOptionNames.every((optionName) =>
          product.options.some((option) => option.name === optionName),
        )
      ) {
        return null;
      }

      // Filter variants that match all selected filters
      const filteredVariants = product.variants.nodes.filter((variant) => {
        return variant.selectedOptions.every((option) => {
          const selectedValuesForOption = selectedFilters[option.name];
          // If no filter is selected for this option, include all values
          if (
            !selectedValuesForOption ||
            selectedValuesForOption.length === 0
          ) {
            return true;
          }

          // Check if the variant's option value matches any selected values
          return selectedValuesForOption.includes(option.value);
        });
      });

      // If product has no matching variants after filtering, exclude it
      if (filteredVariants.length === 0) {
        return null;
      }

      // Return product with filtered variants
      return {
        ...product,
        variants: {
          ...product.variants,
          nodes: filteredVariants,
        },
      };
    })
    .filter(Boolean); // Remove null products
}

function loadCollection(
  collectionHandle: string,
  storefront: Storefront,
  request: Request,
): Promise<CollectionQuery> {
  const paginationVariables = getPaginationVariables(request, {
    // BB NOTE: I want to limit the initial load to 50, but then the "Load more" should load 250.
    pageBy: 50,
  });

  if (!collectionHandle) {
    throw redirect('/');
  }

  const collection = storefront.query(COLLECTION_QUERY, {
    variables: {handle: collectionHandle, ...paginationVariables},
    // Add other queries here, so that they are loaded in parallel
  });

  if (!collection) {
    throw new Response(`Collection ${collectionHandle} not found`, {
      status: 404,
    });
  }

  return collection;
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params, request}: LoaderFunctionArgs) {
  return {};
}

export default function Category() {
  const data = useLoaderData<typeof loader>();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '[navigation] 200px [content] 1fr',
      }}
    >
      <div style={{gridColumn: 'navigation'}}>
        <NavigationSidebar categories={data.topLevelCategories} />
        <FilterOptions
          productOptions={data.productOptions}
          selectedFilters={data.selectedFilters}
        />
      </div>
      <div style={{gridColumn: 'content'}}>
        <CategoryAndSubCategoriesDetailPageStyle
          category={data.selectedCategory}
        />
        <Collection />
      </div>
    </div>
  );
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `McHydrogen | ${data?.selectedCategory.name ?? ''} Category`},
  ];
};

function Collection() {
  const {collectionPromise} = useLoaderData<typeof loader>();

  return (
    // BB NOTE: interestingly, by awaiting collectionPromise in the loader and forcing it to render on the server, the page load becomes faster.
    <Suspense fallback={<div>Loading products...</div>}>
      <Await resolve={collectionPromise}>
        {({collection}) => {
          if (!collection) {
            return null;
          }

          return (
            <div className="collection">
              <h1>{collection.title}</h1>
              <p className="collection-description">{collection.description}</p>
              <div>
                {/* BB NOTE: The PaginatedResourceSection is very slow to render */}
                {/* <PaginatedResourceSection connection={collection.products}>
                  {({node: product, index}) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      loading={index < 8 ? 'eager' : undefined}
                    />
                  )}
                </PaginatedResourceSection> */}
                {collection.products.nodes.map((product, index) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    loading={index < 8 ? 'eager' : undefined}
                  />
                ))}
              </div>
              <Analytics.CollectionView
                data={{
                  collection: {
                    id: collection.id,
                    handle: collection.handle,
                  },
                }}
              />
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}

function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variant = product.variants.nodes[0];
  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
  return (
    <div>
      <Link key={product.id} prefetch="intent" to={variantUrl}>
        <h4>{product.title}</h4>
      </Link>
      <div
        style={{fontSize: '0.75rem'}}
        dangerouslySetInnerHTML={{__html: product.descriptionHtml}}
      />
      <div style={{display: 'flex', flexDirection: 'row'}}>
        {product.featuredImage && (
          <Image
            alt={product.featuredImage.altText || product.title}
            data={product.featuredImage}
            decoding={loading === 'eager' ? 'sync' : 'async'}
            loading={loading}
            width={88}
          />
        )}
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>{product.options[0].name}</th>
              {product.options[1] && <th>{product.options[1].name}</th>}
              <th>Model</th>
              <th>Net Weight</th>
              <th>Each</th>
              <th>Buy</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.nodes.map((variant) => (
              <tr key={variant.id}>
                <td>{variant.sku}</td>
                <td>{variant.selectedOptions[0].value}</td>
                {product.options[1] && (
                  <td>{variant.selectedOptions[1].value}</td>
                )}
                <td>{variant.title}</td>
                <td>{variant.weight}</td>
                <td>
                  <Money data={variant.price} />
                </td>
                <td>
                  {/* BB NOTE:The AddToCartButton seems to have very bad performance */}
                  <AddToCartButton
                    lines={[
                      {
                        merchandiseId: variant.id,
                        quantity: 1,
                        selectedVariant: variant,
                      },
                    ]}
                  >
                    Add to cart
                  </AddToCartButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterOptions({
  productOptions,
  selectedFilters,
}: {
  productOptions: Record<string, string[]>;
  selectedFilters: Record<string, string[]>;
}) {
  return (
    <div style={{marginTop: '2rem', fontSize: 10.5}}>
      <h3>Filter Options</h3>
      <Form method="get">
        {Object.entries(productOptions).map(([optionName, values]) => (
          <div key={optionName} style={{marginBottom: '1rem'}}>
            <h4 style={{marginBottom: '0.5rem'}}>{optionName}</h4>
            {values.map((value) => (
              <FilterCheckbox
                key={value}
                optionName={optionName}
                value={value}
                isChecked={selectedFilters[optionName]?.includes(value)}
              />
            ))}
          </div>
        ))}
        <button
          type="submit"
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          Apply Filters
        </button>
      </Form>
    </div>
  );
}

function FilterCheckbox({
  optionName,
  value,
  isChecked,
}: {
  optionName: string;
  value: string;
  isChecked: boolean;
}) {
  const submit = useSubmit();

  return (
    <div style={{marginLeft: '0.5rem'}}>
      <input
        type="checkbox"
        name={optionName}
        value={value}
        checked={isChecked}
        style={{transform: 'scale(0.9)', verticalAlign: 'middle'}}
        onChange={(e) => {
          submit(e.currentTarget.form);
        }}
      />
      <label htmlFor={value}>{value}</label>
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    descriptionHtml
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    options(first: 250) {
      name
    }
    variants(first: 250) {
      nodes {
        id
        sku
        selectedOptions {
          name
          value
        }
        title
        weight
        price {
          ...MoneyProductItem
        }
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
