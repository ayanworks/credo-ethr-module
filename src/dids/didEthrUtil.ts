import type { DidCreateResult, DidDocument, Key } from '@credo-ts/core'

import { CredoError, DidDocumentBuilder, DidDocumentService, getEd25519VerificationKey2020 } from '@credo-ts/core'

import { SECURITY_CONTEXT_SECP256k1_RECOVERY_URL } from '../signature-suites/EcdsaSecp256k1RecoveryMethod2020'

export const ethereumDidRegex = new RegExp(/^did:ethr(:[0-9a-fA-F])?:0x[0-9a-fA-F]{40}$/)

export const isValidEthereumDid = (did: string) => ethereumDidRegex.test(did)

export function failedResult(reason: string): DidCreateResult {
  return {
    didDocumentMetadata: {},
    didRegistrationMetadata: {},
    didState: {
      state: 'failed',
      reason: reason,
    },
  }
}

export function getSecp256k1DidDoc(did: string, key: Key, serviceEndpoint?: string): DidDocument {
  const verificationMethod = getEd25519VerificationKey2020({
    id: `${did}#key-1`,
    key,
    controller: did,
  })

  const didDocumentBuilder = new DidDocumentBuilder(did)
  didDocumentBuilder.addContext(SECURITY_CONTEXT_SECP256k1_RECOVERY_URL).addVerificationMethod(verificationMethod)

  if (serviceEndpoint) {
    const service = new DidDocumentService({
      id: `${did}#linked-domain`,
      serviceEndpoint,
      type: 'LinkedDomains',
    })

    didDocumentBuilder.addService(service)
  }

  if (!key.supportsEncrypting && !key.supportsSigning) {
    throw new CredoError('Key must support at least signing or encrypting')
  }

  if (key.supportsSigning) {
    didDocumentBuilder
      .addAuthentication(verificationMethod.id)
      .addAssertionMethod(verificationMethod.id)
      .addCapabilityDelegation(verificationMethod.id)
      .addCapabilityInvocation(verificationMethod.id)
  }

  if (key.supportsEncrypting) {
    didDocumentBuilder.addKeyAgreement(verificationMethod.id)
  }

  return didDocumentBuilder.build()
}
