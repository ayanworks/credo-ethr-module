import type { DidDocument } from '@credo-ts/core'

import {
  DidDocumentBuilder,
  DidDocumentService,
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  VerificationMethod,
} from '@credo-ts/core'

import { SECURITY_CONTEXT_SECP256k1_RECOVERY_URL } from '../signature-suites'

export function getSecp256k1DidDocWithPublicKey(
  did: string,
  publicKeyBase58: string,
  serviceEndpoint?: string
): DidDocument {
  const verificationMethod = new VerificationMethod({
    id: `${did}#key-1`,
    type: VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
    controller: did,
    publicKeyBase58,
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

  didDocumentBuilder
    .addAuthentication(verificationMethod.id)
    .addAssertionMethod(verificationMethod.id)
    .addCapabilityDelegation(verificationMethod.id)
    .addCapabilityInvocation(verificationMethod.id)

  didDocumentBuilder.addKeyAgreement(verificationMethod.id)

  return didDocumentBuilder.build()
}
