export type NetworkListRow = {
  ID: string;
  Name: string;
  Driver: string;
  Scope: string;
};

export type NetworkInspect = {
  Name: string;
  Id: string;
  Driver: string;
  Scope: string;
  Internal?: boolean;
  Attachable?: boolean;
  EnableIPv6?: boolean;
  IPAM?: any;
  Labels?: Record<string, string>;
  Options?: Record<string, string>;
  Containers?: Record<
    string,
    {
      Name: string;
      EndpointID: string;
      MacAddress: string;
      IPv4Address: string;
      IPv6Address: string;
    }
  >;
};

export type NetworkWithDetails = NetworkListRow & {
  Internal?: boolean;
  Attachable?: boolean;
  EnableIPv6?: boolean;
  ContainerCount?: number;
};
