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
  const [{category}] = await Promise.all([
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
    categories: childCategories,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  return {};
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
