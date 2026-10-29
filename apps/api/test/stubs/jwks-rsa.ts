// Jest-only stand-in: jwks-rsa 4 pulls in ESM-only jose 6, which Jest's CommonJS runtime can't load.
// Unit tests sign HS256, so reaching the JWKS path is a test bug.
export default class JwksClient {
  constructor() {
    throw new Error("jwks-rsa is stubbed in unit tests; use an HS256 token");
  }
}
export { JwksClient };
