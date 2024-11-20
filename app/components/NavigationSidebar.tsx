import {NavLink} from '@remix-run/react';
import type {Category} from '../lib/categories';

export function NavigationSidebar({categories}: {categories: Category[]}) {
  return (
    <div style={{fontSize: 11}}>
      {categories.map((category) => (
        <NavLink
          key={category.collectionHandle}
          prefetch="intent"
          to={`/categories/${category.metaobjectHandle}`}
          style={({isActive}) => ({
            display: 'block',
            fontWeight: isActive ? 'bold' : 'normal',
          })}
        >
          {category.name}
        </NavLink>
      ))}
    </div>
  );
}
