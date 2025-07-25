import { AgentContext, injectable } from '@credo-ts/core'

import { EthereumLedgerService } from './ledger'

@injectable()
export class EthereumApi {
  private agentContext: AgentContext
  private ledgerService: EthereumLedgerService

  public constructor(agentContext: AgentContext, ledgerService: EthereumLedgerService) {
    this.agentContext = agentContext
    this.ledgerService = ledgerService
  }

  public async createSchema({ did, schemaName, schema }: { did: string; schemaName: string; schema: object }) {
    const schemaDetails = await this.ledgerService.createSchema(this.agentContext, { did, schemaName, schema })
    return schemaDetails
  }

  public async getSchemaById(did: string, schemaId: string) {
    const schemaDetails = await this.ledgerService.getSchemaByDidAndSchemaId(this.agentContext, did, schemaId)
    return schemaDetails
  }
}
