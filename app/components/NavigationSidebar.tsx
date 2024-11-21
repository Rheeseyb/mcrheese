import {NavLink} from '@remix-run/react';
import type {Category} from '../lib/categories';

export function NavigationSidebar({categories}: {categories: Category[]}) {
  return (
    <div style={{fontSize: 11}}>
      {categories.map((category) => (
        <NavLink
          key={category.collectionHandle}
          reloadDocument // BB Note: using reloadDocument is dramatically faster because the pages are massive and their hydration is very costly
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
