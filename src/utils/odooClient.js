import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  baseURL: `${config.odooUrl}/web/dataset/call_kw`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.odooApiKey}`,
  },
  timeout: 15000,
});

export async function odooSearchRead(model, domain = [], fields = [], kwargs = {}) {
  const payload = { jsonrpc: '2.0', method: 'call', params: {
    model, method: 'search_read', args: [domain, fields], kwargs
  }};
  const { data } = await client.post('', payload);
  if (data?.error) {
    const msg = data.error?.data?.message || 'Odoo error';
    const name = data.error?.data?.name || 'OdooError';
    const e = new Error(msg);
    e.code = name;
    throw e;
  }
  return data?.result || [];
}

export default { odooSearchRead };
