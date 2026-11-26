import photos from "./event-photos.json";
export type EventPhoto = { src: string; alt: string; city: string };
export type EventAlbum = { id: string; title: string; location: string; label: string; description: string; cover: EventPhoto; photos: EventPhoto[]; version: number };
const pick = (city: "pune" | "indore", indices: number[]) => indices.map(i => photos[city][i]);
export const defaultEventAlbums: EventAlbum[] = [
  { id: "pune", title: "The Pune edit", location: "Pune", label: "City journal", description: "A closer look at INOX in Pune: our showcase, the people we met, and conversations around considered spaces.", cover: pick("pune", [2])[0], photos: photos.pune, version: 1 },

  { id: "indore", title: "The Indore edit", location: "Indore", label: "City journal", description: "Explore our Indore event through the collection displays, material discoveries and moments shared with the design community.", cover: pick("indore", [2])[0], photos: photos.indore, version: 1 },

  { id: "showcase", title: "Inside the showcase", location: "Pune & Indore", label: "Spaces & displays", description: "Step inside the INOX displays. Discover how finishes, textures and architectural details come together in an exhibition setting.", cover: pick("pune", [0])[0], photos: [...pick("pune", [0,1,2,12,53]), ...pick("indore", [1,2,3,19,54])], version: 1 },

  { id: "details", title: "Designed to be discovered", location: "Indore", label: "Materials & details", description: "An up-close study of the surfaces, patterns and functional details on display. A gallery for those who appreciate the finer points of design.", cover: pick("indore", [7])[0], photos: pick("indore", [7,8,9,10,11,4,5,6,14,34,39,43]), version: 1 },

  { id: "connections", title: "Conversations that connect", location: "Pune & Indore", label: "People & perspectives", description: "Design begins with a conversation. Meet the people behind the exchanges, product walkthroughs and shared discoveries at our Pune and Indore events.", cover: pick("pune", [25])[0], photos: [...pick("pune", [25,5,6,10,22,30,50,62]), ...pick("indore", [17,21,28,44,48,51])], version: 1 },

  { id: "highlights", title: "Moments of inspiration", location: "Pune & Indore", label: "From the event floor", description: "From the conference stage to the exhibition floor, revisit a selection of moments that brought the design community together.", cover: pick("pune", [13])[0], photos: [...pick("pune", [13,14,16,51,66,81,83]), ...pick("indore", [23,25,26,36,53])], version: 1 },
  
];
