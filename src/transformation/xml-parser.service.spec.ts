import { jest } from '@jest/globals';
import { XmlParserService } from './xml-parser.service';
import { AppLogger } from '../logger/app-logger.service';
import {
  XmlParsingException,
  TransformationException,
} from '../common/exceptions/ingestion.exceptions';

describe('XmlParserService', () => {
  let service: XmlParserService;
  let loggerMock: jest.Mocked<AppLogger>;

  beforeEach(() => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      logApiFailure: jest.fn(),
      logTransformationError: jest.fn(),
      logLifecycleEvent: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    service = new XmlParserService(loggerMock);
  });

  describe('parseMakesXml', () => {
    it('should parse valid makes XML with multiple makes', () => {
      const xml = `
        <Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <Count>2</Count>
          <Message>Response returned successfully</Message>
          <Results>
            <AllVehicleMakes>
              <Make_ID>12858</Make_ID>
              <Make_Name>#1 ALPINE CUSTOMS</Make_Name>
            </AllVehicleMakes>
            <AllVehicleMakes>
              <Make_ID>440</Make_ID>
              <Make_Name>ASTON MARTIN</Make_Name>
            </AllVehicleMakes>
          </Results>
        </Response>
      `;

      const result = service.parseMakesXml(xml);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        makeId: '12858',
        makeName: '#1 ALPINE CUSTOMS',
      });
      expect(result[1]).toEqual({
        makeId: '440',
        makeName: 'ASTON MARTIN',
      });
    });

    it('should parse single make correctly as an array', () => {
      const xml = `
        <Response>
          <Results>
            <AllVehicleMakes>
              <Make_ID>440</Make_ID>
              <Make_Name>ASTON MARTIN</Make_Name>
            </AllVehicleMakes>
          </Results>
        </Response>
      `;

      const result = service.parseMakesXml(xml);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        makeId: '440',
        makeName: 'ASTON MARTIN',
      });
    });

    it('should return empty array when Results is empty', () => {
      const xml = `
        <Response>
          <Results></Results>
        </Response>
      `;

      const result = service.parseMakesXml(xml);
      expect(result).toEqual([]);
    });

    it('should throw XmlParsingException when XML is invalid syntax', () => {
      const malformedXml = '<Response><Results><AllVehicleMakes></Response>';
      expect(() => service.parseMakesXml(malformedXml)).toThrow(
        XmlParsingException,
      );
      expect(loggerMock.logTransformationError).toHaveBeenCalled();
    });

    it('should throw XmlParsingException when input is empty string or null', () => {
      expect(() => service.parseMakesXml('')).toThrow(XmlParsingException);
    });
  });

  describe('parseVehicleTypesXml', () => {
    it('should parse valid vehicle types XML', () => {
      const xml = `
        <Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <Count>2</Count>
          <Message>Response returned successfully</Message>
          <SearchCriteria>Make ID: 440</SearchCriteria>
          <Results>
            <VehicleTypesForMakeIds>
              <VehicleTypeId>2</VehicleTypeId>
              <VehicleTypeName>Passenger Car</VehicleTypeName>
            </VehicleTypesForMakeIds>
            <VehicleTypesForMakeIds>
              <VehicleTypeId>7</VehicleTypeId>
              <VehicleTypeName>Multipurpose Passenger Vehicle (MPV)</VehicleTypeName>
            </VehicleTypesForMakeIds>
          </Results>
        </Response>
      `;

      const result = service.parseVehicleTypesXml(xml);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        typeId: '2',
        typeName: 'Passenger Car',
      });
      expect(result[1]).toEqual({
        typeId: '7',
        typeName: 'Multipurpose Passenger Vehicle (MPV)',
      });
    });

    it('should parse single vehicle type as array', () => {
      const xml = `
        <Response>
          <Results>
            <VehicleTypesForMakeIds>
              <VehicleTypeId>2</VehicleTypeId>
              <VehicleTypeName>Passenger Car</VehicleTypeName>
            </VehicleTypesForMakeIds>
          </Results>
        </Response>
      `;

      const result = service.parseVehicleTypesXml(xml);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        typeId: '2',
        typeName: 'Passenger Car',
      });
    });

    it('should return empty array when no vehicle types exist', () => {
      const xml = `
        <Response>
          <Count>0</Count>
          <Results/>
        </Response>
      `;

      const result = service.parseVehicleTypesXml(xml);
      expect(result).toEqual([]);
    });

    it('should throw XmlParsingException for malformed XML', () => {
      const malformedXml = '<Response><unclosed>';
      expect(() => service.parseVehicleTypesXml(malformedXml)).toThrow(
        XmlParsingException,
      );
      expect(loggerMock.logTransformationError).toHaveBeenCalled();
    });
  });

  describe('combineMakeWithVehicleTypes', () => {
    it('should transform raw data into target JSON structure matching gist format', () => {
      const make = { makeId: '440', makeName: 'ASTON MARTIN' };
      const vehicleTypes = [
        { typeId: '2', typeName: 'Passenger Car' },
        { typeId: '7', typeName: 'Multipurpose Passenger Vehicle (MPV)' },
      ];

      const transformed = service.combineMakeWithVehicleTypes(
        make,
        vehicleTypes,
      );

      expect(transformed).toEqual({
        makeId: '440',
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          {
            typeId: '2',
            typeName: 'Passenger Car',
          },
          {
            typeId: '7',
            typeName: 'Multipurpose Passenger Vehicle (MPV)',
          },
        ],
      });
    });

    it('should handle make with empty vehicle types', () => {
      const make = { makeId: '9999', makeName: 'TEST MAKE' };
      const transformed = service.combineMakeWithVehicleTypes(make, []);

      expect(transformed).toEqual({
        makeId: '9999',
        makeName: 'TEST MAKE',
        vehicleTypes: [],
      });
    });

    it('should throw TransformationException if makeId is missing', () => {
      const invalidMake = { makeId: '', makeName: 'EMPTY MAKE' };
      expect(() =>
        service.combineMakeWithVehicleTypes(invalidMake, []),
      ).toThrow(TransformationException);
    });
  });
});
