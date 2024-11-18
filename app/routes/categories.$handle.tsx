import {CategoryAndSubCategoriesDetailPageStyle} from '../components/CategoryAndSubCategories';
import {CATEGORIES_METAOBJECT_QUERY, processCategory} from '../lib/categories';

import {defer, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction, Await} from '@remix-run/react';
import {
  getPaginationVariables,
  Image,
  Money,
  Analytics,
  Storefront,
} from '@shopify/hydrogen';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {Suspense} from 'react';
import {NavigationSidebar} from '../components/NavigationSidebar';

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return defer({...deferredData, ...criticalData});
}

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

  return {
    selectedCategory: processedCategory,
    topLevelCategories: processCategory(rootCategory).subCategories,
    collectionPromise: loadCollection(
      processedCategory.collectionHandle!,
      context.storefront,
      request,
    ),
  };
}

function loadCollection(
  collectionHandle: string,
  storefront: Storefront,
  request: Request,
) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 250,
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
    <Suspense>
      <Await resolve={collectionPromise}>
        {({collection}) => {
          if (!collection) {
            return null;
          }

          return (
            <div className="collection">
              <h1>{collection.title}</h1>
              <p className="collection-description">{collection.description}</p>
              <PaginatedResourceSection
                connection={collection.products}
                resourcesClassName="products-grid"
              >
                {({node: product, index}) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    loading={index < 8 ? 'eager' : undefined}
                  />
                )}
              </PaginatedResourceSection>
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
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {product.featuredImage && (
        <Image
          alt={product.featuredImage.altText || product.title}
          data={product.featuredImage}
          loading={loading}
          width={100}
          height={100}
        />
      )}
      <h4>{product.title}</h4>
      <small>
        <Money data={product.priceRange.minVariantPrice} />
      </small>
    </Link>
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
    variants(first: 1) {
      nodes {
        selectedOptions {
          name
          value
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
