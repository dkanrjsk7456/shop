import axios from 'axios';
import csv from 'csv-parser';
import { Readable } from 'stream';

const REPO_OWNER = 'sammy310';
const REPO_NAME = 'Danawa-Crawler';
export const categories = ['CPU', 'VGA', 'MBoard', 'RAM', 'SSD', 'HDD', 'Cooler', 'Case', 'Power'] as const;

export type Category = typeof categories[number];

export interface DanawaItem {
  Id: string;
  Name: string;
  Price: string;
  [key: string]: string;
}

function isRecentCPU(cpuName: string): boolean {
  const lowerCaseName = cpuName.toLowerCase();
  
  // Intel CPU: 12세대부터 이후 세대
  if (lowerCaseName.includes('인텔') || lowerCaseName.includes('intel')) {
    const match = lowerCaseName.match(/(\d{1,2})세대|i\d[-\s]?(\d{4,5})/);
    if (match) {
      const generation = parseInt(match[1] || match[2].substring(0, 2));
      return generation >= 12;
    }
  }
  
  // AMD CPU: Ryzen 3세대 이상
  if (lowerCaseName.includes('amd') || lowerCaseName.includes('ryzen')) {
    const match = lowerCaseName.match(/\b(3[0-9]{3}|[4-9][0-9]{3})/);
    if (match) {
      const series = parseInt(match[0]);
      return series >= 3000;
    }
  }
  
  return false;
}

export function getCPUGeneration(cpuName: string): number {
  const lowerCaseName = cpuName.toLowerCase();
  if (lowerCaseName.includes('intel') || lowerCaseName.includes('인텔')) {
    const match = lowerCaseName.match(/(\d{1,2})세대|i\d[-\s]?(\d{4,5})/);
    if (match) {
      return parseInt(match[1] || match[2].substring(0, 2));
    }
  } else if (lowerCaseName.includes('amd') || lowerCaseName.includes('ryzen')) {
    const match = lowerCaseName.match(/\b(3[0-9]{3}|[4-9][0-9]{3})/);
    if (match) {
      return Math.floor(parseInt(match[0]) / 1000);
    }
  }
  return 0; // 세대를 파악할 수 없는 경우
}

export function sortCPUs(cpus: DanawaItem[], ascending: boolean = true): DanawaItem[] {
  return cpus.sort((a, b) => {
    const priceA = parseFloat(a.Price?.replace(/[^0-9.-]+/g, '') || '0');
    const priceB = parseFloat(b.Price?.replace(/[^0-9.-]+/g, '') || '0');
    if (priceA !== priceB) {
      return ascending ? priceA - priceB : priceB - priceA;
    }
    // 가격이 같은 경우 세대로 정렬
    const genA = getCPUGeneration(a.Name);
    const genB = getCPUGeneration(b.Name);
    return ascending ? genA - genB : genB - genA;
  });
}

export async function fetchDanawaData(category: Category): Promise<DanawaItem[] | null> {
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master/crawl_data/${category}.csv`;
  
  try {
    const response = await axios.get<string>(url);

    const results: DanawaItem[] = [];
    return new Promise((resolve, reject) => {
      Readable.from(response.data)
        .pipe(csv())
        .on('data', (data: DanawaItem) => {
          if (category === 'CPU') {
            if (isRecentCPU(data.Name)) {
              results.push(data);
            }
          } else {
            results.push(data);
          }
        })
        .on('end', () => {
          if (category === 'CPU') {
            resolve(sortCPUs(results));
          } else {
            resolve(results);
          }
        })
        .on('error', (error: Error) => reject(error));
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error fetching ${category} data:`, error.response?.status, error.response?.data);
    } else {
      console.error(`Error fetching ${category} data:`, error);
    }
    return null;
  }
}

export async function fetchAllDanawaData(): Promise<Partial<Record<Category, DanawaItem[] | null>>> {
  const data: Partial<Record<Category, DanawaItem[] | null>> = {};
  await Promise.all(categories.map(async (category) => {
    data[category] = await fetchDanawaData(category);
  }));
  return data;
}