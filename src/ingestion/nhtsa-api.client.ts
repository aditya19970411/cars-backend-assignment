import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../logger/app-logger.service';
import { ExternalApiException } from '../common/exceptions/ingestion.exceptions';

@Injectable()
export class NhtsaApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.baseUrl =
      this.configService.get<string>('nhtsa.baseUrl') ||
      'https://vpic.nhtsa.dot.gov/api/vehicles';
    this.timeoutMs = this.configService.get<number>('nhtsa.timeoutMs') || 15000;
    this.maxRetries = this.configService.get<number>('nhtsa.maxRetries') ?? 3;
  }

  /**
   * Fetches all vehicle makes in XML format from NHTSA API
   */
  async fetchAllMakesXml(): Promise<string> {
    const url = `${this.baseUrl}/getallmakes?format=XML`;
    return this.fetchWithRetry(url, 'fetchAllMakesXml');
  }

  /**
   * Fetches vehicle types for a specific make ID in XML format from NHTSA API
   */
  async fetchVehicleTypesForMakeXml(makeId: string): Promise<string> {
    if (!makeId) {
      throw new ExternalApiException('Make ID must be provided');
    }
    const url = `${this.baseUrl}/GetVehicleTypesForMakeId/${encodeURIComponent(makeId)}?format=xml`;
    return this.fetchWithRetry(url, `fetchVehicleTypesForMakeXml(${makeId})`);
  }

  /**
   * Executes HTTP GET with timeout, exponential backoff, and error handling
   */
  private async fetchWithRetry(
    url: string,
    operationName: string,
  ): Promise<string> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/xml, text/xml, */*',
            'User-Agent': 'CarsBackendService/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new ExternalApiException(
            `NHTSA API responded with status ${response.status} ${response.statusText}`,
            response.status,
            url,
          );
        }

        return await response.text();
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        attempt++;

        const isTimeout = err instanceof Error && err.name === 'AbortError';
        const errorMessage = isTimeout
          ? `Request timed out after ${this.timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err);

        this.logger.warn(
          `[${operationName}] Attempt ${attempt}/${this.maxRetries + 1} failed: ${errorMessage}`,
        );

        if (attempt <= this.maxRetries) {
          // Exponential backoff with jitter: 200ms, 400ms, 800ms...
          const backoffDelay = Math.min(
            100 * Math.pow(2, attempt) + Math.random() * 100,
            2000,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    this.logger.logApiFailure(url, lastError, {
      operation: operationName,
      attempts: attempt,
    });

    throw new ExternalApiException(
      `Failed to fetch data from ${url} after ${this.maxRetries + 1} attempts`,
      undefined,
      url,
      lastError,
    );
  }
}
