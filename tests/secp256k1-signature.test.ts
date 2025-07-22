import type { AgentContext } from '@credo-ts/core'

import { AskarWallet } from '@credo-ts/askar'
import { AskarModuleConfig } from '@credo-ts/askar/build/AskarModuleConfig'
import {
  ClaimFormat,
  W3cJsonLdVerifiablePresentation,
  KeyType,
  JsonTransformer,
  SigningProviderRegistry,
  W3cCredential,
  CredentialIssuancePurpose,
  vcLibraries,
  W3cPresentation,
  TypedArrayEncoder,
  W3cJsonLdVerifiableCredential,
  SignatureSuiteRegistry,
  InjectionSymbols,
  ConsoleLogger,
  LogLevel,
  DidsModuleConfig,
  CredoError,
  CacheModuleConfig,
  InMemoryLruCache,
} from '@credo-ts/core'
import { W3cCredentialsModuleConfig } from '@credo-ts/core/build/modules/vc/W3cCredentialsModuleConfig'
import { W3cJsonLdCredentialService } from '@credo-ts/core/build/modules/vc/data-integrity/W3cJsonLdCredentialService'
import { LinkedDataProof } from '@credo-ts/core/build/modules/vc/data-integrity/models/LinkedDataProof'
import { agentDependencies } from '@credo-ts/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'

import { EthereumModuleConfig } from '../src/EthereumModuleConfig'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'
import { EcdsaSecp256k1RecoverySignature2020 } from '../src/signature-suites'

import { EcdsaSecp256k1Signature2019Fixtures } from './fixtures'
import { getAgentConfig, getAgentContext } from './utils'

export const askarModuleConfig = new AskarModuleConfig({ ariesAskar })
registerAriesAskar({ askar: askarModuleConfig.ariesAskar })

const { jsonldSignatures } = vcLibraries
const { purposes } = jsonldSignatures

const signatureSuiteRegistry = new SignatureSuiteRegistry([
  {
    suiteClass: EcdsaSecp256k1RecoverySignature2020,
    proofType: 'EcdsaSecp256k1RecoverySignature2020',
    verificationMethodTypes: ['EcdsaSecp256k1RecoveryMethod2020'],
    keyTypes: [KeyType.K256],
  },
])

describe('Secp256k1 W3cCredentialService', () => {
  let wallet: AskarWallet
  let agentContext: AgentContext
  let w3cJsonLdCredentialService: W3cJsonLdCredentialService
  const privateKey = TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6')

  beforeAll(async () => {
    const agentConfig = getAgentConfig('EcdsaSecp256k1e2eTest')

    wallet = new AskarWallet(agentConfig.logger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))
    await wallet.createAndOpen(agentConfig.walletConfig)
    agentContext = getAgentContext({
      agentConfig,
      wallet,
      registerInstances: [
        [InjectionSymbols.Logger, new ConsoleLogger(LogLevel.info)],
        [
          DidsModuleConfig,
          new DidsModuleConfig({
            resolvers: [new EthereumDidResolver()],
            registrars: [new EthereumDidRegistrar()],
          }),
        ],
        [
          CacheModuleConfig,
          new CacheModuleConfig({
            cache: new InMemoryLruCache({ limit: 50 }),
          }),
        ],
        [
          EthereumModuleConfig,
          new EthereumModuleConfig({
            config: {
              networks: [
                {
                  name: 'sepolia',
                  chainId: 11155111,
                  rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/m0SEA2hYFe149nEdKYMPao8Uv_ZrPqeM',
                  registry: '0x485cFb9cdB84c0a5AfE69b75E2e79497Fc2256Fc',
                },
              ],
            },
          }),
        ],
      ],
    })
    w3cJsonLdCredentialService = new W3cJsonLdCredentialService(
      signatureSuiteRegistry,
      new W3cCredentialsModuleConfig()
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Utility methods', () => {
    describe('getKeyTypesByProofType', () => {
      it('should return the correct key types for EcdsaSecp256k1RecoverySignature2020 proof type', async () => {
        const keyTypes = w3cJsonLdCredentialService.getKeyTypesByProofType('EcdsaSecp256k1RecoverySignature2020')
        expect(keyTypes).toEqual([KeyType.K256])
      })
    })

    describe('getVerificationMethodTypesByProofType', () => {
      it('should return the correct key types for EcdsaSecp256k1RecoverySignature2020 proof type', async () => {
        const verificationMethodTypes = w3cJsonLdCredentialService.getVerificationMethodTypesByProofType(
          'EcdsaSecp256k1RecoverySignature2020'
        )
        expect(verificationMethodTypes).toEqual(['EcdsaSecp256k1RecoveryMethod2020'])
      })
    })
  })

  describe('EcdsaSecp256k1Signature2019', () => {
    let issuerDid: string
    let verificationMethod: string

    beforeAll(async () => {
      await wallet.createKey({ keyType: KeyType.K256, privateKey })

      issuerDid = 'did:ethr:sepolia:0x4A09b8CB511cca4Ca1c5dB0475D0e07bFc96EF49'
      verificationMethod = `${issuerDid}#controller`
    })

    describe('signCredential', () => {
      it('should return a successfully signed credential secp256k1', async () => {
        const credentialJson = EcdsaSecp256k1Signature2019Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDid

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'EcdsaSecp256k1RecoverySignature2020',
          verificationMethod: verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDid)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        vc.proof = vc.proof as LinkedDataProof
        expect(vc.proof.verificationMethod).toEqual(verificationMethod)
      })

      it('should throw because of verificationMethod does not belong to this wallet', async () => {
        const credentialJson = EcdsaSecp256k1Signature2019Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDid

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        expect(async () => {
          await w3cJsonLdCredentialService.signCredential(agentContext, {
            format: ClaimFormat.LdpVc,
            credential,
            proofType: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:ethereum:testnet:0x4A09b8CB511cca4Ca1c5dB0475D0e07bFc96EF47#key-1',
          })
        }).rejects.toThrowError(CredoError)
      })
    })

    // describe('verifyCredential', () => {
    //   it('should verify the credential successfully', async () => {
    //     const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, {
    //       credential: JsonTransformer.fromJSON(
    //         EcdsaSecp256k1Signature2019Fixtures.TEST_LD_DOCUMENT_SIGNED,
    //         W3cJsonLdVerifiableCredential
    //       ),
    //       proofPurpose: new purposes.AssertionProofPurpose(),
    //     })

    //     expect(result.isValid).toEqual(true)
    //   })

    //   it('should fail because of invalid signature', async () => {
    //     const vc = JsonTransformer.fromJSON(
    //       EcdsaSecp256k1Signature2019Fixtures.TEST_LD_DOCUMENT_BAD_SIGNED,
    //       W3cJsonLdVerifiableCredential
    //     )
    //     const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

    //     expect(result).toEqual({
    //       isValid: false,
    //       error: expect.any(Error),
    //       validations: {
    //         vcJs: {
    //           error: expect.any(Error),
    //           isValid: false,
    //           results: expect.any(Array),
    //         },
    //       },
    //     })
    //   })
    // })

    // describe('signPresentation', () => {
    //   it('should successfully create a presentation from single verifiable credential', async () => {
    //     const presentation = JsonTransformer.fromJSON(
    //       EcdsaSecp256k1Signature2019Fixtures.TEST_VP_DOCUMENT,
    //       W3cPresentation
    //     )

    //     const purpose = new CredentialIssuancePurpose({
    //       controller: {
    //         id: verificationMethod,
    //       },
    //       date: new Date().toISOString(),
    //     })

    //     const verifiablePresentation = await w3cJsonLdCredentialService.signPresentation(agentContext, {
    //       format: ClaimFormat.LdpVp,
    //       presentation: presentation,
    //       proofPurpose: purpose,
    //       proofType: 'EcdsaSecp256k1Signature2019',
    //       challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
    //       domain: 'issuer.example.com',
    //       verificationMethod: verificationMethod,
    //     })

    //     expect(verifiablePresentation).toBeInstanceOf(W3cJsonLdVerifiablePresentation)
    //   })
    // })

    // describe('verifyPresentation', () => {
    //   it('should successfully verify a presentation containing a single verifiable credential', async () => {
    //     const vp = JsonTransformer.fromJSON(
    //       EcdsaSecp256k1Signature2019Fixtures.TEST_VP_DOCUMENT_SIGNED,
    //       W3cJsonLdVerifiablePresentation
    //     )

    //     const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
    //       presentation: vp,
    //       challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
    //     })

    //     expect(result).toEqual({
    //       isValid: true,
    //       error: undefined,
    //       validations: {
    //         vcJs: {
    //           isValid: true,
    //           presentationResult: expect.any(Object),
    //           credentialResults: expect.any(Array),
    //         },
    //       },
    //     })
    //   })

    //   it('should fail when presentation signature is not valid', async () => {
    //     const vp = JsonTransformer.fromJSON(
    //       {
    //         ...EcdsaSecp256k1Signature2019Fixtures.TEST_VP_DOCUMENT_SIGNED,
    //         proof: {
    //           ...EcdsaSecp256k1Signature2019Fixtures.TEST_VP_DOCUMENT_SIGNED.proof,
    //           jws: EcdsaSecp256k1Signature2019Fixtures.TEST_VP_DOCUMENT_SIGNED.proof.jws + 'a',
    //         },
    //       },
    //       W3cJsonLdVerifiablePresentation
    //     )

    //     const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
    //       presentation: vp,
    //       challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
    //     })

    //     expect(result).toEqual({
    //       isValid: false,
    //       error: expect.any(Error),
    //       validations: {
    //         vcJs: {
    //           isValid: false,
    //           credentialResults: expect.any(Array),
    //           presentationResult: expect.any(Object),
    //           error: expect.any(Error),
    //         },
    //       },
    //     })
    //   })
    // })
  })
})
