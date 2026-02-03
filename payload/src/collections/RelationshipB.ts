import type { CollectionConfig } from 'payload'

export const RelationshipB: CollectionConfig = {
  slug: 'relationship-b',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    }
  ]
}