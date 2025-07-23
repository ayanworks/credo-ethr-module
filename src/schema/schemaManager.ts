import type { SigningKey } from 'ethers'

import { utils } from '@credo-ts/core'
import axios from 'axios'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'

import SchemaRegistryAbi from '../abi/SchemaRegistry.json'
import { buildSchemaResource } from '../utils/schemaHelper'
import { parseAddress } from '../utils/utils'

export type DidInitOptions = {
  rpcUrl: string
  signingKey: SigningKey
  schemaManagerContractAddress: string
  serverUrl: string
  fileServerToken: string
}

export type ResourcePayload = {
  resourceURI: string
  resourceCollectionId: string
  resourceId: string
  resourceName: string
  resourceType: string
  mediaType: string
  created: string
  checksum: string
  previousVersionId: string | null
  nextVersionId: string | null
}

export class EthrSchema {
  private schemaRegistry: Contract
  private fileServerUrl: string
  private accessToken: string
  private schemaManagerContractAddress: string
  private rpcUrl: string

  public constructor({ schemaManagerContractAddress, rpcUrl, serverUrl, fileServerToken, signingKey }: DidInitOptions) {
    this.schemaManagerContractAddress = schemaManagerContractAddress
    this.rpcUrl = rpcUrl
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(signingKey, provider)
    this.accessToken = fileServerToken
    this.fileServerUrl = serverUrl
    this.schemaRegistry = new Contract(schemaManagerContractAddress, SchemaRegistryAbi, wallet)
  }

  public async createSchema(did: string, schemaName: string, schema: object, address: string) {
    if (!schemaName || Object?.keys(schema)?.length === 0) {
      throw new Error(`Schema name and Schema are required!`)
    }

    let schemaId
    const tnxSchemaId = ''
    const schemaTxhash: string = ''
    address = parseAddress(address)

    if (!this.accessToken) {
      throw new Error(`Invalid token!`)
    }

    try {
      schemaId = utils.uuid()
      const schemaResource: ResourcePayload = await buildSchemaResource(did, schemaId, schemaName, schema, address)

      const schemaTxnReceipt = await this.schemaRegistry.createSchema(address, schemaId, JSON.stringify(schemaResource))
      // To change the nonce for next transaction
      await schemaTxnReceipt.wait()

      if (!schemaTxnReceipt.hash) {
        throw new Error(`Error while adding schema in Registry!`)
      }

      const uploadSchemaDetails = await this.uploadSchemaFile(schemaId, schema)

      if (!uploadSchemaDetails) {
        throw new Error(`Error while uploading schema on file server!`)
      }

      return {
        did,
        schemaId,
        schemaTxnHash: schemaTxnReceipt.hash,
        // resourceTxnHash: addedResourcetxnReceipt.hash, //WIP
      }
    } catch (error) {
      return {
        tnxSchemaId,
        schemaTxhash,
        schemaState: {
          state: 'failed',
          reason: `unknownError: ${error}`,
        },
      }
    }
  }

  public async getSchemaById(did: string, schemaId: string, address: string) {
    try {
      if (!schemaId) {
        throw new Error('Schema id is required!')
      }

      address = parseAddress(address)

      const schemaDetails = await this.schemaRegistry.getSchemaById(address, schemaId)
      if (!schemaDetails) {
        throw new Error('Error while fetching schema details by schema id!')
      }
      return JSON.parse(schemaDetails)
    } catch (error) {
      throw new Error(`Error occurred in getSchemaById function ${error}`)
    }
  }

  private async uploadSchemaFile(schemaResourceId: string, schema: object) {
    try {
      if (!schemaResourceId || Object?.keys(schema)?.length === 0) {
        throw new Error(`Schema resource id and schema are required!`)
      }

      const schemaPayload = {
        schemaId: `${schemaResourceId}`,
        schema,
      }

      const axiosOptions = {
        method: 'post',
        url: `${this.fileServerUrl}/schemas`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        data: JSON.stringify(schemaPayload),
      }
      const response = await axios(axiosOptions)
      return response
    } catch (error) {
      throw new Error(`Error occurred in uploadSchemaFile function ${error} `)
      throw error
    }
  }
}
