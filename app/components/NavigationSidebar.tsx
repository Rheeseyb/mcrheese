import {NavLink, useNavigation, useNavigate} from '@remix-run/react';
import type {Category} from '../lib/categories';

export function NavigationSidebar({categories}: {categories: Category[]}) {
  const navigate = useNavigate();

  return (
    <div style={{fontSize: 11}}>
      <PendingNavigation />
      {categories.map((category) => (
        <NavLink
          key={category.collectionHandle}
          prefetch="viewport"
          to={`/categories/${category.metaobjectHandle}`}
          // we navigate on onMouseDown to match McLiquid and NextFaster
          onMouseDown={(e) => {
            e.preventDefault();
            navigate(`/categories/${category.metaobjectHandle}`);
          }}
          onClick={(e) => {
            e.preventDefault();
          }}
          style={({isActive, isPending}) => ({
            display: 'block',
            fontWeight: isActive ? 'bold' : 'normal',
            textDecoration: isPending ? 'underline' : 'none',
          })}
        >
          {category.name}
        </NavLink>
      ))}
    </div>
  );
}

function PendingNavigation() {
  const navigation = useNavigation();
  return navigation.state === 'loading' ? 'SPINNER' : '.';
}
