import {useLoaderData} from '@remix-run/react';
import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CategoryAndSubCategories} from '../components/CategoryAndSubCategories';
import {CATEGORIES_METAOBJECT_QUERY, processCategory} from '../lib/categories';

export async function loader({context, params}: LoaderFunctionArgs) {
  const {handle} = params;

  const {category} = await context.storefront.query(
    CATEGORIES_METAOBJECT_QUERY,
    {
      variables: {
        handle: handle!,
      },
    },
  );

  if (category == null) {
    throw new Response('Category not found', {status: 404});
  }

  return {rootCategory: processCategory(category)};
}

export default function Category() {
  const data = useLoaderData<typeof loader>();
  return (
    <div>
      <CategoryAndSubCategories category={data.rootCategory} />
    </div>
  );
}
