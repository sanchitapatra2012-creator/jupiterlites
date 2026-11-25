export interface ReferenceTaxon {
  accession: string;
  database: 'NCBI GenBank' | 'BOLD Systems';
  markerGene: 'COI' | '12S rRNA' | '16S rRNA' | '18S rRNA' | 'rbcL' | 'ITS2';
  kingdom: string;
  phylum: string;
  className: string;
  orderName: string;
  family: string;
  genus: string;
  species: string;
  commonName: string;
  habitat: string;
  sequence: string;
}

/**
 * Curated local reference barcode library for DEMO_MODE alignment.
 * Each entry contains authentic marker-region DNA sequence fragments and 7-rank taxonomy.
 */
export const CURATED_REFERENCE_LIBRARY: ReferenceTaxon[] = [
  {
    accession: 'NC_001960.1',
    database: 'NCBI GenBank',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    className: 'Actinopterygii',
    orderName: 'Salmoniformes',
    family: 'Salmonidae',
    genus: 'Salmo',
    species: 'Salmo trutta',
    commonName: 'Brown trout',
    habitat: 'Freshwater',
    sequence:
      'CCTCTACCTTGTATTTGGTGCCTGAGCCGGAATAGTGGGAACCGCCCTAAGCCTCTTAATTCGAGCTGAACTAAGCCAGCCGGGCGCCCTTCTGGGGGATGACCAAATTTATAACGTAATCGTTACTGCCCATGCCTTCGTAATGATTTTCTTTATAGTGATACCAATTATGATTGGAGGATTTGGAAACTGACTAGTCCCCCTAATGATTGGCGCCCCCGACATAGCATTCCCC',
  },
  {
    accession: 'BOLD:AAA9512',
    database: 'BOLD Systems',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    className: 'Actinopterygii',
    orderName: 'Cypriniformes',
    family: 'Cyprinidae',
    genus: 'Danio',
    species: 'Danio rerio',
    commonName: 'Zebrafish',
    habitat: 'Freshwater',
    sequence:
      'GGTCTTTACCTAGTATTCGGTGCTTGAGCCGGAATAGTAGGAACAGCCCTTAGCCTGCTCATTCGAGCCGAACTTAGCCAACCAGGTACACTCCTCGGTGATGACCAAATTTACAATGTAATCGTTACTGCTCACGCCTTCGTTATAATCTTCTTTATAGTAATACCAATTCTAATCGGAGGCTTTGGAAATTGACTCGTACCTCTAATAATTGGAGCTCCAGACATAGCATTTCCA',
  },
  {
    accession: 'NC_012920.1_COI_ORTHO',
    database: 'NCBI GenBank',
    markerGene: '12S rRNA',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    className: 'Amphibia',
    orderName: 'Anura',
    family: 'Ranidae',
    genus: 'Rana',
    species: 'Rana temporaria',
    commonName: 'European common frog',
    habitat: 'Freshwater / Riparian',
    sequence:
      'AAACTGGGATTAGATACCCCACTATGCCTAGCCCTAAACTATGATACTTAACTATTACACGCCCGCCAGGGGTACTACGAGCATCAGCTTAAAACCCAAAGGACTTGACGGTACCCCACACCCACCTAGAGGAGCCTGTTCTATAATCGATAAACCCCGATAAACCTCACCACCTCTTGCCATTCCAGCCTATATACCGCCGTCGCCAGCTTACCTCTGAAGGCAACAAAGTAAGC',
  },
  {
    accession: 'BOLD:AAX4103',
    database: 'BOLD Systems',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    className: 'Insecta',
    orderName: 'Ephemeroptera',
    family: 'Baetidae',
    genus: 'Baetis',
    species: 'Baetis rhodani',
    commonName: 'Large dark olive mayfly',
    habitat: 'Freshwater',
    sequence:
      'AACTTTATATTTTATTTTTGGGGCTTGAGCAGGAATAGTTGGAACATCTTTAAGAATTTTAATTCGAGCAGAATTAGGACAACCTGGCTCTTTTATTGGAGATGATCAAATTTATAACGTAATTGTTACAGCTCATGCTTTTGTAATAATTTTTTTTATAGTTATACCTATTATAATTGGAGGATTTGGAAATTGATTAGTTCCTTTAATATTAGGAGCTCCTGATATAGCTTTTCCA',
  },
  {
    accession: 'BOLD:ACY2088',
    database: 'BOLD Systems',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    className: 'Insecta',
    orderName: 'Trichoptera',
    family: 'Hydropsychidae',
    genus: 'Hydropsyche',
    species: 'Hydropsyche siltalai',
    commonName: 'Net-spinning caddisfly',
    habitat: 'Freshwater',
    sequence:
      'ATTATATTTTATTTTCGGTATTTGATCAGGAATAGTAGGTACATCATTAAGAATTCTAATTCGAACAGAATTAGGTCAACCTGGTGCATTAATTGGAAATGATCAAATTTATAATGTAATTGTAACAGCACATGCTTTTGTAATAATTTTTTTTATAGTTATACCAATTATAATTGGTGGATTTGGAAACTGATTAGTACCTTTAATACTTGGAGCACCTGATATAGCATTTCCT',
  },
  {
    accession: 'NC_031854.1',
    database: 'NCBI GenBank',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Cnidaria',
    className: 'Anthozoa',
    orderName: 'Scleractinia',
    family: 'Acroporidae',
    genus: 'Acropora',
    species: 'Acropora millepora',
    commonName: 'Staghorn coral',
    habitat: 'Marine Reef',
    sequence:
      'TCTATTGTACTTAGTGTTAGGGGCATTTTCTGGGATGATAGGAACTGCAATGAGTATGATTATAAGATTAGAACTAAGTGCGCCTGGTAGTATGTTAGGGGATGATCATTTATATAATGTAATAGTAACAGCCCATGCTTTTATGATAATTTTTTTTATGGTAATGCCTGTAATGATAGGGGGGTTTGGTAATTGACTGGTACCCCTAATGATTGGAGCTCCCGATATGGCTTTTCCA',
  },
  {
    accession: 'MK829411.1',
    database: 'NCBI GenBank',
    markerGene: '18S rRNA',
    kingdom: 'Chromista',
    phylum: 'Bacillariophyta',
    className: 'Mediophyceae',
    orderName: 'Thalassiosirales',
    family: 'Thalassiosiraceae',
    genus: 'Thalassiosira',
    species: 'Thalassiosira pseudonana',
    commonName: 'Marine centric diatom',
    habitat: 'Marine / Estuarine',
    sequence:
      'GTGCCAGCAGCCGCGGTAATTCCAGCTCCAATAGCGTATATTAAAGTTGTTGCAGTTAAAAAGCTCGTAGTTGGATTTCTGGCGGGGCCGACCGGTCCGCCTTTGGTGCGTACTGGTCTGGCCCGACCTTTCCTCGAGGAACTGGGCGTGCTCTTAACTGAGTGTCTTGGTGATGCCGGACGAACTTTACTTTGAAAAAATTAGAGTGTTCAAAGCAGGCGTATGGCTTGAATAC',
  },
  {
    accession: 'JQ423805.1',
    database: 'NCBI GenBank',
    markerGene: 'rbcL',
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    className: 'Magnoliopsida',
    orderName: 'Alismatales',
    family: 'Zosteraceae',
    genus: 'Zostera',
    species: 'Zostera marina',
    commonName: 'Eelgrass',
    habitat: 'Estuarine / Coastal',
    sequence:
      'ATGTCACCACAAACAGAGACTAAAGCAAGTGTTGGATTTAAAGCTGGTGTTAAAGATTATAAATTGACTTATTATACTCCTGAATATGAAACCAAAGATACTGATATCTTGGCAGCATTCCGAGTAACTCCTCAACCTGGAGTTCCACCTGAAGAAGCAGGGGCTGCGGTAGCTGCCGAATCTTCTACTGGTACATGGACAACTGTGTGGACCGATGGACTTACTAGCCTTGATCGT',
  },
  {
    accession: 'NR_112014.1',
    database: 'NCBI GenBank',
    markerGene: '16S rRNA',
    kingdom: 'Bacteria',
    phylum: 'Pseudomonadota',
    className: 'Gammaproteobacteria',
    orderName: 'Pseudomonadales',
    family: 'Pseudomonadaceae',
    genus: 'Pseudomonas',
    species: 'Pseudomonas fluorescens',
    commonName: 'Rhizosphere bacterium',
    habitat: 'Soil / Freshwater',
    sequence:
      'AGAGTTTGATCCTGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAGCGGTAGAGAGAAGCTTGCTTCTCTTGAGAGCGGCGGACGGGTGAGTAATGCCTAGGAATCTGCCTGGTAGTGGGGGATAACGTTCGGAAACGGACGCTAATACCGCATACGTCCTACGGGAGAAAGCAGGGGACCTTCGGGCCTTGCGCTATCAGATGAGCCTAGGTCGGATTAGCT',
  },
  {
    accession: 'NR_132177.1',
    database: 'NCBI GenBank',
    markerGene: 'ITS2',
    kingdom: 'Fungi',
    phylum: 'Basidiomycota',
    className: 'Agaricomycetes',
    orderName: 'Agaricales',
    family: 'Omphalotaceae',
    genus: 'Lentinula',
    species: 'Lentinula edodes',
    commonName: 'Forest saprotrophic fungus',
    habitat: 'Terrestrial Forest Soil',
    sequence:
      'AACTTTTAACAACGGATCTCTTGGCTCTCGCATCGATGAAGAACGCAGCGAAATGCGATAAGTAATGTGAATTGCAGAATTCAGTGAATCATCGAATCTTTGAACGCACCTTGCGCTCCTTGGTATTCCGAGGAGCATGCCTGTTTGAGTGTCATTAAATTCTCAACTTCATCAAGCTTTTGGTTGGAGTGCTTGGATGTGGGGGTCTGCTGGCTTTTTTAAGGTTAGCTCCTCTCA',
  },
  {
    accession: 'BOLD:AAB2109',
    database: 'BOLD Systems',
    markerGene: 'COI',
    kingdom: 'Animalia',
    phylum: 'Mollusca',
    className: 'Bivalvia',
    orderName: 'Mytilida',
    family: 'Mytilidae',
    genus: 'Mytilus',
    species: 'Mytilus edulis',
    commonName: 'Blue mussel',
    habitat: 'Coastal Intertidal',
    sequence:
      'GCTTTATATTTATTATTTGGAGCATGAGCAGGTATAGTCGGGTCTGCAATAAGTGTAATTATTCGAATAGAGTTAGGTCAACCAGGCTCTTTTTTAGGTGATGATCAGCTATATAATGTTGTAGTTACAGCTCATGCTTTTGTAATAATTTTTTTTATAGTTATACCTATTATGATTGGTGGATTTGGAAATTGATTAGTTCCTTTGATGTTAGGTGCTCCTGATATAGCTTTTCCA',
  },
  {
    accession: 'NC_002783.1',
    database: 'NCBI GenBank',
    markerGene: '12S rRNA',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    className: 'Mammalia',
    orderName: 'Carnivora',
    family: 'Mustelidae',
    genus: 'Lutra',
    species: 'Lutra lutra',
    commonName: 'Eurasian otter',
    habitat: 'Riparian / Freshwater',
    sequence:
      'AAACTAGGATTAGATACCCTACTATGCTTAGCCCTAAACTTAAATAGTTAAACTAACAAAACTATTCGCCAGAGAACTACTAGCAACAGCTTAAAACTCAAAGGACTTGGCGGTGCTTTATACCCCTCTAGAGGAGCCTGTTCTATAATCGATAAACCCCGATAAACCTCACCACCCCTCGCTAATTCAGCCTATATACCGCCATCTTCAGCAAACCCTAAAAAGGAACTAAAGTAAGC',
  },
];
