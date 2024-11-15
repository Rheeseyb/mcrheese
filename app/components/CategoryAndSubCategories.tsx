import {Link} from '@remix-run/react';
import {Image} from '@shopify/hydrogen';
import type {Category} from '~/lib/categories';

export function CategoryAndSubCategories({category}: {category: Category}) {
  return (
    <div key={category.collectionHandle}>
      <Link
        to={`/categories/${category.metaobjectHandle}`}
        style={{
          fontSize: '1.5em',
          color: '#363',
          paddingBottom: 6,
          letterSpacing: -0.5,
        }}
      >
        {category.name}
      </Link>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 62px)',
          gridTemplateRows: 'repeat(auto-fill, 114px)',
          gap: 10,
          paddingBottom: 12,
        }}
      >
        {category.subCategories.map((category) => (
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
            {category.name?.split('>').at(-1)}
          </Link>
        ))}
      </div>
    </div>
  );
}
