import {useParams} from '@remix-run/react';
import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CATEGORIES_METAOBJECT_QUERY} from '../lib/categories';

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

  return null;
}

export default function Category() {
  const {handle} = useParams();
  return <div>Category {handle}</div>;
}
