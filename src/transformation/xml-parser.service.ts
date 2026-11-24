import { Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { AppLogger } from '../logger/app-logger.service';
import {
  XmlParsingException,
  TransformationException,
} from '../common/exceptions/ingestion.exceptions';
import {
  RawMakeItem,
  RawVehicleTypeItem,
  TransformedMake,
  TransformedVehicleType,
} from './types/transformation.types';

@Injectable()
export class XmlParserService {
  private readonly parser: XMLParser;

  constructor(private readonly logger: AppLogger) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
      parseTagValue: false, // Keep string values to prevent unexpected coercion
      isArray: (name) => {
        return name === 'AllVehicleMakes' || name === 'VehicleTypesForMakeIds';
      },
    });
  }

  /**
   * Parses XML from NHTSA getallmakes endpoint into typed RawMakeItem[]
   */
  parseMakesXml(xmlContent: string): RawMakeItem[] {
    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new XmlParsingException('Empty or non-string XML input provided');
    }

    const validationResult = XMLValidator.validate(xmlContent);
    if (validationResult !== true) {
      const err = new XmlParsingException(
        `Invalid XML syntax: ${JSON.stringify(validationResult.err)}`,
      );
      this.logger.logTransformationError('parseMakesXml', err);
      throw err;
    }

    try {
      const parsed = this.parser.parse(xmlContent);
      const makesNode = parsed?.Response?.Results?.AllVehicleMakes;

      if (!makesNode) {
        return [];
      }

      const list = Array.isArray(makesNode) ? makesNode : [makesNode];

      return list
        .filter(
          (item) =>
            item && (item.Make_ID !== undefined || item.MakeId !== undefined),
        )
        .map((item) => {
          const makeId = String(item.Make_ID ?? item.MakeId ?? '').trim();
          const makeName = String(item.Make_Name ?? item.MakeName ?? '').trim();
          return {
            makeId,
            makeName,
          };
        });
    } catch (error) {
      const err = new XmlParsingException(
        'Failed to parse XML response for makes',
        error,
      );
      this.logger.logTransformationError('parseMakesXml', err);
      throw err;
    }
  }

  /**
   * Parses XML from NHTSA GetVehicleTypesForMakeId endpoint into typed RawVehicleTypeItem[]
   */
  parseVehicleTypesXml(xmlContent: string): RawVehicleTypeItem[] {
    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new XmlParsingException('Empty or non-string XML input provided');
    }

    const validationResult = XMLValidator.validate(xmlContent);
    if (validationResult !== true) {
      const err = new XmlParsingException(
        `Invalid XML syntax: ${JSON.stringify(validationResult.err)}`,
      );
      this.logger.logTransformationError('parseVehicleTypesXml', err);
      throw err;
    }

    try {
      const parsed = this.parser.parse(xmlContent);
      const typesNode = parsed?.Response?.Results?.VehicleTypesForMakeIds;

      if (!typesNode) {
        return [];
      }

      const list = Array.isArray(typesNode) ? typesNode : [typesNode];

      return list
        .filter(
          (item) =>
            item &&
            (item.VehicleTypeId !== undefined ||
              item.Vehicle_Type_Id !== undefined ||
              item.Vehicle_Type_ID !== undefined),
        )
        .map((item) => {
          const typeId = String(
            item.VehicleTypeId ??
              item.Vehicle_Type_Id ??
              item.Vehicle_Type_ID ??
              '',
          ).trim();
          const typeName = String(
            item.VehicleTypeName ?? item.Vehicle_Type_Name ?? '',
          ).trim();
          return {
            typeId,
            typeName,
          };
        });
    } catch (error) {
      const err = new XmlParsingException(
        'Failed to parse XML response for vehicle types',
        error,
      );
      this.logger.logTransformationError('parseVehicleTypesXml', err);
      throw err;
    }
  }

  /**
   * Combines raw make and vehicle types into the exact target JSON structure:
   * {
   *   "makeId": "440",
   *   "makeName": "ASTON MARTIN",
   *   "vehicleTypes": [
   *     { "typeId": "2", "typeName": "Passenger Car" }
   *   ]
   * }
   */
  combineMakeWithVehicleTypes(
    make: RawMakeItem,
    vehicleTypes: RawVehicleTypeItem[],
  ): TransformedMake {
    if (!make || !make.makeId) {
      throw new TransformationException(
        'Cannot transform make without a valid makeId',
      );
    }

    const transformedTypes: TransformedVehicleType[] = (vehicleTypes || []).map(
      (vt) => ({
        typeId: String(vt.typeId),
        typeName: String(vt.typeName || ''),
      }),
    );

    return {
      makeId: String(make.makeId),
      makeName: String(make.makeName || ''),
      vehicleTypes: transformedTypes,
    };
  }
}
