/**
 * Utility for GIS (Easting, Northing, Elevation) <-> Three.js (X, Y_Elev, Z_North)
 * coordinate system conversions and bounding volume calculations.
 */
export interface BoundingBox3D {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

export class GeoCoordinates {
  /**
   * Converts world GIS coordinates (Easting, Northing, Elevation) to
   * Three.js local space (X = East, Y = Up/Elev, Z = North) centered at origin.
   * The X axis is inverted to match standard viewpoint orientation.
   */
  public static toLocal(
    easting: number,
    northing: number,
    elevation: number,
    center: [number, number, number]
  ): [number, number, number] {
    return [
      -(easting - center[0]),
      elevation - center[1],
      northing - center[2]
    ];
  }

  /**
   * Converts Three.js local space (X = East, Y = Up/Elev, Z = North) back to
   * real-world GIS coordinates (Easting, Northing, Elevation).
   */
  public static toWorld(
    localX: number,
    localElev: number,
    localNorth: number,
    center: [number, number, number]
  ): [number, number, number] {
    return [
      -localX + center[0],
      localNorth + center[2],
      localElev + center[1]
    ];
  }

  /**
   * Computes normalized elevation in range [0, 1] given local elevation, minimum elevation, and elevation span.
   */
  public static normalizeElevation(elevation: number, minElevation: number, span: number): number {
    return (elevation - minElevation) / (span || 1.0);
  }

  /**
   * Builds standardized bounding box and extents for ParseResult
   * Min/Max/Center formatted as [X, Z_elev, Y_north] matching GIS extent representation.
   */
  public static computeBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): BoundingBox3D {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return {
      min: [minX, minZ, minY],
      max: [maxX, maxZ, maxY],
      center: [centerX, centerZ, centerY],
      size: [maxX - minX, maxZ - minZ, maxY - minY]
    };
  }
}
