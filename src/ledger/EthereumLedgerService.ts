import type { AgentContext, Wallet } from '@credo-ts/core'

import { AskarProfileWallet, AskarWallet } from '@credo-ts/askar'
import { CredoError, DidRepository, TypedArrayEncoder, WalletError, injectable } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { SigningKey } from 'ethers'
import { getResolver } from 'ethr-did-resolver'

import { EthereumModuleConfig } from '../EthereumModuleConfig'
import { EthrSchema } from '../schema/schemaManager'
import { getPreferredKey } from '../utils/utils'

export enum SchemaOperation {
  CreateSchema = 'createSchema',
}

@injectable()
export class EthereumLedgerService {
  public readonly rpcUrl: string
  private readonly schemaManagerContractAddress: string
  private readonly fileServerToken: string
  private readonly fileServerUrl: string
  public readonly resolver: Resolver
  public constructor(config: EthereumModuleConfig) {
    this.resolver = new Resolver(getResolver(config.config))
    this.rpcUrl = config.rpcUrl
    this.schemaManagerContractAddress = config.schemaManagerContractAddress
    this.fileServerToken = config.fileServerToken
    this.fileServerUrl = config.serverUrl
  }

  public async createSchema(
    agentContext: AgentContext,
    { did, schemaName, schema }: { did: string; schemaName: string; schema: object }
  ) {
    const keyResult = await this.getPublicKeyFromDid(agentContext, did)

    if (!keyResult.publicKeyBase58) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, keyResult.publicKeyBase58)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    agentContext.config.logger.info(`Creating schema on ledger: ${did}`)

    const response = await schemaRegistry.createSchema(did, schemaName, schema, keyResult.blockchainAccountId)
    if (!response) {
      agentContext.config.logger.error(`Schema creation failed for did: ${did} and schema: ${schema}`)
      throw new CredoError(`Schema creation failed for did: ${did} and schema: ${schema}`)
    }
    agentContext.config.logger.info(`Published schema on ledger: ${did}`)
    return response
  }

  public async getSchemaByDidAndSchemaId(agentContext: AgentContext, did: string, schemaId: string) {
    agentContext.config.logger.info(`Getting schema from ledger: ${did} and schemaId: ${schemaId}`)

    const keyResult = await this.getPublicKeyFromDid(agentContext, did)

    if (!keyResult) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, keyResult.publicKeyBase58)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    const response = await schemaRegistry.getSchemaById(did, schemaId, keyResult.blockchainAccountId)

    if (!response) {
      agentContext.config.logger.error(`Schema not found for did: ${did} and schemaId: ${schemaId} Error: ${response}`)
      throw new CredoError(`Schema not found for did: ${did} and schemaId: ${schemaId}`)
    }
    agentContext.config.logger.info(`Got schema from ledger: ${did} and schemaId: ${schemaId}`)
    return response
  }

  private createSchemaRegistryInstance(signingKey: SigningKey) {
    if (!this.rpcUrl || !this.schemaManagerContractAddress || !this.fileServerToken || !this.fileServerUrl) {
      throw new CredoError('Ethereum schema module config not found')
    }

    return new EthrSchema({
      rpcUrl: this.rpcUrl,
      schemaManagerContractAddress: this.schemaManagerContractAddress,
      fileServerToken: this.fileServerToken,
      serverUrl: this.fileServerUrl,
      signingKey,
    })
  }

  private async getSigningKey(wallet: Wallet, publicKeyBase58: string): Promise<SigningKey> {
    if (!(wallet instanceof AskarWallet) && !(wallet instanceof AskarProfileWallet)) {
      throw new CredoError('Incorrect wallet type: Ethereum Module currently only supports Askar wallet')
    }

    const keyEntry = await wallet.withSession(async (session) => await session.fetchKey({ name: publicKeyBase58 }))

    if (!keyEntry) {
      throw new WalletError('Key not found in wallet')
    }

    const signingKey = new SigningKey(keyEntry.key.secretBytes)

    keyEntry.key.handle.free()

    return signingKey
  }

  private async getPublicKeyFromDid(agentContext: AgentContext, did: string) {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) {
      throw new CredoError('DidRecord not found')
    }

    if (!didRecord.didDocument?.verificationMethod) {
      throw new CredoError('VerificationMethod not found cannot get public key')
    }

    const blockchainAccountId = getPreferredKey(didRecord.didDocument.verificationMethod)

    const keyObj = didRecord.didDocument.verificationMethod.find((obj) => obj.publicKeyHex)

    if (!keyObj || !keyObj.publicKeyHex) {
      throw new CredoError('Public Key hex not found in wallet for did: ' + did)
    }

    const publicKey = TypedArrayEncoder.fromHex(keyObj.publicKeyHex)

    const publicKeyBase58 = TypedArrayEncoder.toBase58(publicKey)

    return { publicKeyBase58, blockchainAccountId }
  }

  public async resolveDID(did: string) {
    return await this.resolver.resolve(did)
  }
}
