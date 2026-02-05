import {
  Collection,
  Document,
  Filter,
  FindOptions,
  ObjectId,
  UpdateFilter,
} from 'mongodb'

import DatabaseManager from '../database/DatabaseManager'

/**
 * Repositório base com operações CRUD genéricas
 * Implementa lazy-loading para a coleção do banco de dados
 */
export abstract class BaseRepository<T extends Document> {
  protected collectionName: string
  private _collection: Collection<T> | null = null

  constructor(collectionName: string) {
    this.collectionName = collectionName
  }

  /**
   * Acessa a coleção, inicializando-a na primeira vez
   */
  protected get collection(): Collection<T> {
    if (!this._collection) {
      this._collection = DatabaseManager.getCollection<T>(this.collectionName)
    }
    return this._collection
  }

  async findById(id: string | ObjectId): Promise<T | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id
    return this.collection.findOne({ _id: objectId } as Filter<T>)
  }

  async find(filter: Filter<T>, options?: FindOptions<T>): Promise<T[]> {
    return this.collection.find(filter, options).toArray()
  }

  /**
   * Busca documentos paginados de forma consistente
   */
  async paginate(
    filter: Filter<T>,
    page: number = 1,
    limit: number = 20,
    options: FindOptions<T> = {},
  ): Promise<{
    data: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const safePage = Math.max(1, page)
    const pageSize = Math.max(1, limit)
    const skip = (safePage - 1) * pageSize

    const cursorOptions: FindOptions<T> = {
      ...options,
      skip,
      limit: pageSize,
    }

    const [data, total] = await Promise.all([
      this.collection.find(filter, cursorOptions).toArray(),
      this.collection.countDocuments(filter),
    ])

    return {
      data,
      total,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }

  async findOne(filter: Filter<T>): Promise<T | null> {
    return this.collection.findOne(filter)
  }

  async create(doc: T): Promise<T> {
    const result = await this.collection.insertOne(doc as any)
    return { ...doc, _id: result.insertedId }
  }

  async deleteOne(filter: Filter<T>): Promise<boolean> {
    const result = await this.collection.deleteOne(filter)
    return result.deletedCount > 0
  }

  async updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(filter, update)
    return result.modifiedCount > 0 || result.upsertedCount > 0
  }

  async updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>,
  ): Promise<boolean> {
    const result = await this.collection.updateMany(filter, update)
    return result.modifiedCount > 0 || result.upsertedCount > 0
  }

  async deleteMany(filter: Filter<T>): Promise<number> {
    const result = await this.collection.deleteMany(filter)
    return result.deletedCount
  }

  async count(filter: Filter<T> = {} as Filter<T>): Promise<number> {
    return this.collection.countDocuments(filter)
  }

  async upsert(
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>,
  ): Promise<T | null> {
    const result = await this.collection.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
    })
    return result
  }
}
