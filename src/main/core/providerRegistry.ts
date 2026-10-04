import type { RummageProvider } from './provider'

export class ProviderRegistry {
  private readonly providers = new Map<string, RummageProvider>()

  register(provider: RummageProvider): void {
    const { id } = provider.manifest
    if (this.providers.has(id)) {
      throw new Error(`Provider already registered: ${id}`)
    }
    this.providers.set(id, provider)
  }

  get(id: string): RummageProvider | undefined {
    return this.providers.get(id)
  }

  list(): RummageProvider[] {
    return [...this.providers.values()]
  }

  disposeAll(): void {
    for (const provider of this.providers.values()) provider.dispose?.()
    this.providers.clear()
  }
}
