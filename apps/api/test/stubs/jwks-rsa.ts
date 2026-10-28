// Jest-only stand-in for jwks-rsa. jwks-rsa 4 pulls in jose 6, which is ESM-only
// and Jest's CommonJS runtime can't load it (Node itself can). Unit tests sign
// HS256 tokens, so the JWKS path is never reached; reaching it is a test bug.
export default class JwksClient {
  constructor() {
    throw new Error("jwks-rsa is stubbed in unit tests; use an HS256 token");
  }
}
export { JwksClient };
