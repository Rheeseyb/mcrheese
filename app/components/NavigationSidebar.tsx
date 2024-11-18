import type {Category} from '../lib/categories';

export function NavigationSidebar({categories}: {categories: Category[]}) {
  return (
    <div style={{fontSize: 11}}>
      {categories.map((category) => (
        <div key={category.collectionHandle}>{category.name}</div>
      ))}
    </div>
  );
}
