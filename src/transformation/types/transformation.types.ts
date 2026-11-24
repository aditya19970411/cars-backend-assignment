export interface RawMakeItem {
  makeId: string;
  makeName: string;
}

export interface RawVehicleTypeItem {
  typeId: string;
  typeName: string;
}

export interface TransformedVehicleType {
  typeId: string;
  typeName: string;
}

export interface TransformedMake {
  makeId: string;
  makeName: string;
  vehicleTypes: TransformedVehicleType[];
}
