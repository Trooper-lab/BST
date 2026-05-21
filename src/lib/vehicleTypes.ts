export type VehicleType = {
  value: string;
  label: string;
  co2: number;
};

// Vehicle types that can be assigned to a driver.
// Must match the invoice row IDs in InvoiceDetailView:
//   vehic_gas     → vehicGas
//   veh_gas_mixto → vehicGasMixto
//   furgo_gas     → furgoGas
export const VEHICLE_TYPES: VehicleType[] = [
  { value: 'vehic_gas',     label: 'VEHÍC. GAS',    co2: 0.18 },
  { value: 'veh_gas_mixto', label: 'VEH.GAS-MIXTO', co2: 0.22 },
  { value: 'furgo_gas',     label: 'FURGO GAS',     co2: 0.12 },
];

export const vehicleLabel = (value: string) =>
  VEHICLE_TYPES.find(v => v.value === value)?.label ?? 'No asignado';

export const co2Factor = (value: string) =>
  VEHICLE_TYPES.find(v => v.value === value)?.co2 ?? 0.20;
