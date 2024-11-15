import {useParams} from '@remix-run/react';
import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({context, params}: LoaderFunctionArgs) {
  const {handle} = params;
  console.log('handle', handle);

  return null;
}

export default function Category() {
  const {handle} = useParams();
  return <div>Category {handle}</div>;
}
