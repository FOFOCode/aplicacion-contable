declare module "bcryptjs" {
  export function compare(s: string, hash: string): Promise<boolean>
  export function compareSync(s: string, hash: string): boolean
  export function hash(s: string, salt: number | string): Promise<string>
  export function hashSync(s: string, salt?: number | string): string
  export function genSaltSync(rounds?: number): string
  const bcrypt: {
    compare: typeof compare
    compareSync: typeof compareSync
    hash: typeof hash
    hashSync: typeof hashSync
    genSaltSync: typeof genSaltSync
  }
  export default bcrypt
}
