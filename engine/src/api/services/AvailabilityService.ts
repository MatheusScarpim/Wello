import availabilityRepository, { AvailabilityDocument } from '../repositories/AvailabilityRepository'

export class AvailabilityService {
  async getSettings() {
    return await availabilityRepository.getSettings()
  }

  async updateSettings(data: Partial<AvailabilityDocument>) {
    return await availabilityRepository.updateSettings(data)
  }
}

export default new AvailabilityService()
