import {type MetaFunction, useLoaderData} from '@remix-run/react';
import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CategoryAndSubCategoriesLandingPageStyle} from '~/components/CategoryAndSubCategories';
import {
  CATEGORIES_METAOBJECT_QUERY,
  type Category,
  processCategory,
} from '~/lib/categories';
import {NavigationSidebar} from '../components/NavigationSidebar';

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
      cache: context.storefront.CacheLong(),
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (category == null) {
    throw new Response('Root Category not found', {status: 404});
  }

  const rootCategory = processCategory(category);

  const childCategories = rootCategory.subCategories;

  return {
    topLevelCategories: childCategories,
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
        <NavigationSidebar categories={data.topLevelCategories} />
      </div>
      <div style={{gridColumn: 'content'}}>
        <AllCategories categories={data.topLevelCategories} />
      </div>
    </div>
  );
}

function AllCategories({categories}: {categories: Category[]}) {
  return (
    <div>
      {categories.map((category) => (
        <CategoryAndSubCategoriesLandingPageStyle
          key={category.metaobjectHandle}
          category={category}
        />
      ))}
    </div>
  );
}
