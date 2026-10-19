import { Configuration, DefaultApi } from '../generated/openapi/client';

export function createServiceApi() {
  return new DefaultApi(
    new Configuration({
      fetchApi: window.lingguang.service.fetch,
    }),
  );
}
