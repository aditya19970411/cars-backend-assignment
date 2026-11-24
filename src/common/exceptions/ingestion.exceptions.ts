export class XmlParsingException extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'XmlParsingException';
  }
}

export class TransformationException extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'TransformationException';
  }
}

export class ExternalApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ExternalApiException';
  }
}
