import {PrismaClient} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const breeds = [
  'Golden Retriever', 'Husky', 'Beagle', 'Labrador', 'Corgi', 'French Bulldog',
  'Boxer', 'Australian Shepherd', 'Goldendoodle', 'Cavalier King Charles Spaniel',
  'Bernese Mountain Dog', 'Cocker Spaniel', 'German Shepherd', 'Jack Russell Terrier',
  'Great Dane', 'Maltese', 'Poodle', 'Shih Tzu', 'Mixed Breed', 'Irish Setter',
  'Chihuahua', 'Pit Bull', 'Terrier Mix', 'Weimaraner', 'English Bulldog',
  'Papillon', 'Border Collie', 'Basset Hound', 'Whippet', 'Irish Wolfhound',
  'Rhodesian Ridgeback', 'Pug', 'Australian Cattle Dog', 'Rottweiler', 'Newfoundland',
  'Miniature Schnauzer', 'Shetland Sheepdog', 'Vizsla', 'Bichon Frise', 'Akita',
  'Boston Terrier', 'Bloodhound', 'Yorkshire Terrier', 'Springer Spaniel',
  'Chocolate Lab', 'Scottish Terrier', 'Dalmatian', 'Pomeranian',
];

const locations = [
  'San Francisco, CA',
  'Los Angeles, CA',
  'Seattle, WA',
  'Portland, OR',
  'Denver, CO',
  'Austin, TX',
  'Chicago, IL',
  'New York, NY',
  'Boston, MA',
  'Miami, FL',
  'Phoenix, AZ',
  'San Diego, CA',
];

const puppies = [
  {name: 'Buddy', description: 'A friendly golden retriever who loves belly rubs and playing fetch.', breed: 'Golden Retriever'},
  {name: 'Luna', description: 'A gentle husky with striking blue eyes and a playful spirit.', breed: 'Husky'},
  {name: 'Max', description: 'An energetic beagle puppy who follows his nose everywhere.', breed: 'Beagle'},
  {name: 'Bella', description: 'A sweet labrador who gets along great with kids and other pets.', breed: 'Labrador'},
  {name: 'Charlie', description: 'A curious corgi with short legs and a big personality.', breed: 'Corgi'},
  {name: 'Daisy', description: 'A calm French bulldog who enjoys cuddles on the couch.', breed: 'French Bulldog'},
  {name: 'Rocky', description: 'A muscular boxer with a gentle soul and protective instincts.', breed: 'Boxer'},
  {name: 'Sadie', description: 'A graceful Australian shepherd who loves to herd anything that moves.', breed: 'Australian Shepherd'},
  {name: 'Tucker', description: 'A goofy golden doodle with curly fur and endless energy.', breed: 'Goldendoodle'},
  {name: 'Molly', description: 'A petite Cavalier King Charles spaniel who craves lap time.', breed: 'Cavalier King Charles Spaniel'},
  {name: 'Bear', description: 'A fluffy Bernese mountain dog with a calm and steady temperament.', breed: 'Bernese Mountain Dog'},
  {name: 'Bailey', description: 'A cheerful cocker spaniel with floppy ears and a wagging tail.', breed: 'Cocker Spaniel'},
  {name: 'Duke', description: 'A noble German shepherd with sharp intelligence and loyalty.', breed: 'German Shepherd'},
  {name: 'Maggie', description: 'A spunky Jack Russell terrier who never runs out of steam.', breed: 'Jack Russell Terrier'},
  {name: 'Zeus', description: 'A towering Great Dane who thinks he is a lap dog.', breed: 'Great Dane'},
  {name: 'Sophie', description: 'A dainty Maltese with silky white fur and a sweet disposition.', breed: 'Maltese'},
  {name: 'Bentley', description: 'A sophisticated poodle with impeccable manners and style.', breed: 'Poodle'},
  {name: 'Chloe', description: 'A sassy Shih Tzu who rules the house with her charm.', breed: 'Shih Tzu'},
  {name: 'Cooper', description: 'A lovable mixed breed with spots and an adventurous spirit.', breed: 'Mixed Breed'},
  {name: 'Penny', description: 'A red-coated Irish setter with boundless enthusiasm for life.', breed: 'Irish Setter'},
  {name: 'Milo', description: 'A tiny Chihuahua with a big attitude and even bigger heart.', breed: 'Chihuahua'},
  {name: 'Rosie', description: 'A gentle pit bull with a wide smile and loving nature.', breed: 'Pit Bull'},
  {name: 'Oscar', description: 'A scruffy terrier mix who loves digging and exploring.', breed: 'Terrier Mix'},
  {name: 'Ruby', description: 'A stunning Weimaraner with sleek gray fur and amber eyes.', breed: 'Weimaraner'},
  {name: 'Louie', description: 'A wrinkly English bulldog who snores louder than he barks.', breed: 'English Bulldog'},
  {name: 'Lily', description: 'A delicate papillon with butterfly-like ears and quick feet.', breed: 'Papillon'},
  {name: 'Finn', description: 'A water-loving Labrador who will fetch anything from the lake.', breed: 'Labrador'},
  {name: 'Zoey', description: 'A playful border collie with incredible agility and smarts.', breed: 'Border Collie'},
  {name: 'Gus', description: 'A chunky basset hound with droopy eyes and a keen nose.', breed: 'Basset Hound'},
  {name: 'Stella', description: 'An elegant whippet who zooms around the yard at lightning speed.', breed: 'Whippet'},
  {name: 'Murphy', description: 'A happy-go-lucky Irish wolfhound with a shaggy coat.', breed: 'Irish Wolfhound'},
  {name: 'Nala', description: 'A regal Rhodesian ridgeback with a distinctive back stripe.', breed: 'Rhodesian Ridgeback'},
  {name: 'Ollie', description: 'A mischievous pug who snorts and makes everyone laugh.', breed: 'Pug'},
  {name: 'Hazel', description: 'A clever Australian cattle dog with a speckled coat.', breed: 'Australian Cattle Dog'},
  {name: 'Bruno', description: 'A sturdy Rottweiler with a heart of gold beneath his tough look.', breed: 'Rottweiler'},
  {name: 'Willow', description: 'A gentle Newfoundland who loves swimming and saving toys from the pool.', breed: 'Newfoundland'},
  {name: 'Scout', description: 'An alert miniature schnauzer with a distinguished beard.', breed: 'Miniature Schnauzer'},
  {name: 'Piper', description: 'A vocal Shetland sheepdog who keeps everyone in line.', breed: 'Shetland Sheepdog'},
  {name: 'Jasper', description: 'A handsome vizsla with rust-colored fur and endless stamina.', breed: 'Vizsla'},
  {name: 'Ellie', description: 'A cuddly Bichon Frise with a fluffy white cloud of fur.', breed: 'Bichon Frise'},
  {name: 'Baxter', description: 'A loyal Akita with a thick coat and quiet confidence.', breed: 'Akita'},
  {name: 'Ivy', description: 'A spirited Boston terrier with a tuxedo-like coat pattern.', breed: 'Boston Terrier'},
  {name: 'Hank', description: 'A laid-back bloodhound with the best nose in the county.', breed: 'Bloodhound'},
  {name: 'Millie', description: 'A perky Yorkshire terrier with a bow in her silky hair.', breed: 'Yorkshire Terrier'},
  {name: 'Theo', description: 'A bouncy springer spaniel who lives for bird watching.', breed: 'Springer Spaniel'},
  {name: 'Coco', description: 'A chocolate lab with soulful eyes and a love for treats.', breed: 'Chocolate Lab'},
  {name: 'Archie', description: 'A feisty Scottish terrier with a wiry coat and bold attitude.', breed: 'Scottish Terrier'},
  {name: 'Lola', description: 'A dramatic Dalmatian with perfect spots and endless grace.', breed: 'Dalmatian'},
  {name: 'Winston', description: 'A dignified English bulldog who takes his naps very seriously.', breed: 'English Bulldog'},
  {name: 'Poppy', description: 'A tiny Pomeranian with a fluffy orange coat and big personality.', breed: 'Pomeranian'},
];

const energyLevels = ['low', 'medium', 'high'];
const genders = ['male', 'female'];
const temperaments = [
  'friendly, playful',
  'calm, gentle',
  'energetic, curious',
  'loyal, protective',
  'affectionate, social',
  'independent, smart',
  'goofy, lovable',
  'alert, confident',
];
const vaccinationStatuses = ['UNKNOWN', 'PARTIAL', 'COMPLETE'] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.message.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.application.deleteMany();
  await prisma.puppyPhoto.deleteMany();
  await prisma.puppy.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating demo users...');

  // Create a few demo users who will "own" the puppies
  const passwordHash = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'sarah@example.com',
        passwordHash,
        name: 'Sarah Johnson',
        phone: '555-0101',
      },
    }),
    prisma.user.create({
      data: {
        email: 'mike@example.com',
        passwordHash,
        name: 'Mike Chen',
        phone: '555-0102',
      },
    }),
    prisma.user.create({
      data: {
        email: 'emma@example.com',
        passwordHash,
        name: 'Emma Williams',
        phone: '555-0103',
      },
    }),
    prisma.user.create({
      data: {
        email: 'david@example.com',
        passwordHash,
        name: 'David Garcia',
        phone: '555-0104',
      },
    }),
    prisma.user.create({
      data: {
        email: 'demo@example.com',
        passwordHash,
        name: 'Demo User',
        phone: '555-0100',
      },
    }),
  ]);

  console.log(`Created ${users.length} demo users`);
  console.log('Demo login: demo@example.com / password123');

  console.log('Seeding puppies...');
  for (const puppy of puppies) {
    const poster = randomChoice(users.slice(0, 4)); // Don't assign to demo user
    await prisma.puppy.create({
      data: {
        ...puppy,
        age: randomInt(2, 24),
        gender: randomChoice(genders),
        weight: Math.round((randomInt(20, 400) / 10) * 10) / 10,
        adoptionFee: randomInt(300, 2500) * 100,
        status: Math.random() > 0.1 ? 'AVAILABLE' : 'ADOPTED',
        requirements: Math.random() > 0.7 ? 'Requires yard or outdoor space' : null,
        location: randomChoice(locations),
        vaccinationStatus: randomChoice(vaccinationStatuses),
        healthRecords: Math.random() > 0.5 ? 'Up to date on all shots. Spayed/neutered.' : null,
        energyLevel: randomChoice(energyLevels),
        goodWithKids: Math.random() > 0.2,
        goodWithPets: Math.random() > 0.3,
        temperament: randomChoice(temperaments),
        posterId: poster.id,
      },
    });
  }

  console.log(`Seeded ${puppies.length} puppies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
