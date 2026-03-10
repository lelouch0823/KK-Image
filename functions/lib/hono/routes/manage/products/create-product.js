import { ProductCatalogService } from '../../../../../services/ProductCatalogService.js';

export async function createManagedProduct(c, body) {
  const service = new ProductCatalogService(c.env.DB);
  return service.createProduct(c, body);
}
