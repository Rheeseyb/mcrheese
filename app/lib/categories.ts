import type {CategoriesMetaobjectQuery} from 'storefrontapi.generated';
import type {Image as ImageType} from '@shopify/hydrogen/storefront-api-types';

export type CategoryImage = Pick<
  ImageType,
  'id' | 'url' | 'altText' | 'width' | 'height'
>;

export type Category = {
  name: string | null;
  description: string;
  categoryMetafieldId: string;
  subCategories: Category[];
  collectionHandle: string | null;
  metaobjectHandle: string | null;
  image: CategoryImage | null;
};

type CategoryNode = NonNullable<
  NonNullable<
    NonNullable<CategoriesMetaobjectQuery['category']>['subCategories']
  >['references']
>['nodes'][number];

export function processCategory(category: CategoryNode): Category {
  return {
    name: category.name?.value ?? null,
    description: category.description?.value ?? '',
    categoryMetafieldId: category.categoryMetafieldId,
    metaobjectHandle: category.metaobjectHandle,
    image: category.image?.reference?.image ?? null,
    subCategories:
      category.subCategories?.references?.nodes.map(processCategory) ?? [],
    collectionHandle: category.collection?.reference?.collectionHandle ?? null,
  };
}

export const CATEGORIES_METAOBJECT_QUERY = `#graphql
  fragment CategoryBasicFields on Metaobject {
    name: field(key: "name") {
      value
    }
    description: field(key: "description") {
      value
    }
    image: field(key: "image") {
      reference {
        ... on MediaImage {
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
    categoryMetafieldId: id
    metaobjectHandle: handle
    collection: field(key: "collection") {
      reference {
        ... on Collection {
          collectionHandle: handle
        }
      }
    }
  }

  fragment SubCategoryFields on Metaobject {
    ...CategoryBasicFields
    subCategories: field(key: "children_categories") {
      references(first: 250) {
        nodes {
          ... on Metaobject {
            ...CategoryBasicFields
          }
        }
      }
    }
  }
  
  fragment TopCategoryFields on Metaobject {
    ...CategoryBasicFields
    subCategories: field(key: "children_categories") {
      references(first: 250) {
        nodes {
          ... on Metaobject {
            ...SubCategoryFields
          }
        }
      }
    }
  }

  query CategoriesMetaobject($handle: String!) {
    category: metaobject(
      handle: {handle: $handle, type: "category_metaobject"}
    ) {
      ...TopCategoryFields
    }
  }
` as const;
