import {redirect} from '@remix-run/server-runtime';

export function loader() {
  throw redirect('/');
}
