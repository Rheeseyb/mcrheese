import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Await, useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import type {
  CategoriesMetaobjectQuery,
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import type {Image as ImageType} from '@shopify/hydrogen/storefront-api-types';
import {
  type Category,
  processCategory,
  CATEGORIES_METAOBJECT_QUERY,
} from '~/lib/categories';

export const meta: MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

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
async function loadCriticalData({context}: LoaderFunctionArgs) {
  const [{collections}, {category}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    context.storefront.query(CATEGORIES_METAOBJECT_QUERY, {
      variables: {
        handle: 'hardware', // this is the root category from which all categories are fetched
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (category == null) {
    throw new Response('Root Category not found', {status: 404});
  }

  const rootCategory = processCategory(category);

  const childCategories = rootCategory.subCategories;

  return {
    featuredCollection: collections.nodes[0],
    categories: childCategories,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .then((data) => ({
      ...data,
      products: {
        ...data.products,
        nodes: data.products.nodes.filter(
          (product) => product.images.nodes.length > 0,
        ),
      },
    }))
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '[navigation] 200px [content] 1fr',
      }}
    >
      <div style={{gridColumn: 'navigation'}}>
        <NavigationSidebar categories={data.categories} />
      </div>
      <div style={{gridColumn: 'content'}}>
        <AllCategories categories={data.categories} />
      </div>
    </div>
  );
}

function NavigationSidebar({categories}: {categories: Category[]}) {
  return (
    <div style={{fontSize: 11}}>
      {categories.map((category) => (
        <div key={category.collectionHandle}>{category.name}</div>
      ))}
    </div>
  );
}

function AllCategories({categories}: {categories: Category[]}) {
  return (
    <div>
      {categories.map((category) => (
        <div key={category.collectionHandle}>
          <div
            style={{
              fontSize: '1.5em',
              color: '#363',
              paddingBottom: 6,
              letterSpacing: -0.5,
            }}
          >
            {category.name}
          </div>
          <SubCategories categories={category.subCategories} />
        </div>
      ))}
    </div>
  );
}

function SubCategories({categories}: {categories: Category[]}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 62px)',
        gridTemplateRows: 'repeat(auto-fill, 114px)',
        gap: 10,
        paddingBottom: 12,
      }}
    >
      {categories.map((category) => (
        <Link
          key={category.categoryMetafieldId}
          to={`/categories/${category.metaobjectHandle}`}
          style={{
            display: 'grid',
            fontSize: 10.5,
            gridTemplateRows: '62px 1fr',
            width: '100%',
          }}
        >
          {category.image && (
            <Image data={category.image} width={62} height={62} />
          )}
          {
            // the category name is in the format "Category > SubCategory"
            category.name?.split('>')[1]
          }
        </Link>
      ))}
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <Link
      className="featured-collection"
      style={{}}
      to={`/collections/${collection.handle}`}
    >
      {image && (
        <div className="featured-collection-image">
          <Image data={image} sizes="100vw" />
        </div>
      )}
      <h1>{collection.title}</h1>
    </Link>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <div className="recommended-products" style={{}}>
      <h2>Recommended Products</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid">
              {response
                ? response.products.nodes.map((product) => (
                    <Link
                      key={product.id}
                      className="recommended-product"
                      to={`/products/${product.handle}`}
                    >
                      <Image
                        data={product.images.nodes[0]}
                        aspectRatio="1/1"
                        sizes="(min-width: 45em) 20vw, 50vw"
                      />
                      <h4>{product.title}</h4>
                      <small>
                        <Money data={product.priceRange.minVariantPrice} />
                      </small>
                    </Link>
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
      <br />
    </div>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 250, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
