import type {
  AgentContext,
  DidCreateOptions,
  DidCreateResult,
  DidRegistrar,
  DidUpdateOptions,
  Buffer,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateResult,
} from '@credo-ts/core'

import { DidRepository, DidRecord, DidDocumentRole, JsonTransformer, DidDocument, KeyType } from '@credo-ts/core'
import { EthrDID } from 'ethr-did'

import { EthereumLedgerService } from '../ledger'

export class EthereumDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['ethr']

  public async create(agentContext: AgentContext, options: EthereumDidCreateOptions): Promise<DidCreateResult> {
    const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const privateKey = options.secret.privateKey

    const key = await agentContext.wallet.createKey({ keyType: KeyType.K256, privateKey })

    const publicKeyHex = key.publicKey.toString('hex')
    const ethrDid = new EthrDID({
      identifier: '0x' + publicKeyHex,
      chainNameOrId: options.options.network,
    })

    agentContext.config.logger.info(`Creating DID on ledger: ${ethrDid.did}`)

    try {
      // DID Document
      const resolvedDocument = await ledgerService.resolveDID(ethrDid.did)

      // update the context

      const didDocument = JsonTransformer.fromJSON(resolvedDocument.didDocument, DidDocument)

      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
      })

      agentContext.config.logger.info(`Saving DID record to wallet: ${didDocument.id} and did document: ${didDocument}`)

      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {
          txn: null,
        },
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument: didDocument,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      agentContext.config.logger.error(`Error registering DID : ${errorMessage}`)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${errorMessage}`,
        },
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    throw new Error('Method not implemented.')
  }
}

export interface EthereumDidCreateOptions extends DidCreateOptions {
  method: 'ethr'
  did?: never
  options: {
    network: string
    endpoint?: string
    address?: string
  }
  secret: {
    privateKey: Buffer
  }
}

export interface EthereumDidUpdateOptions extends DidUpdateOptions {
  method: 'ethr'
  did: string
  didDocument: DidDocument
  secret?: {
    privateKey: Buffer
  }
}
