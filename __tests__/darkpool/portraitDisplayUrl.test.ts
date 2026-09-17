import {
  portraitDisplayUrl,
  snapWikiThumbWidth,
} from '../../screens/DarkPool/utils/investorPlaceholder';

describe('portraitDisplayUrl / Wikimedia thumb snap', () => {
  it('snaps to allowed Wikimedia widths', () => {
    expect(snapWikiThumbWidth(256)).toBe(500);
    expect(snapWikiThumbWidth(320)).toBe(500);
    expect(snapWikiThumbWidth(480)).toBe(500);
    expect(snapWikiThumbWidth(100)).toBe(120);
    expect(snapWikiThumbWidth(200)).toBe(250);
    expect(snapWikiThumbWidth(900)).toBe(960);
    expect(snapWikiThumbWidth(2000)).toBe(1280);
  });

  it('builds a valid thumb URL for curated wiki portraits', () => {
    const trump =
      'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg';
    expect(portraitDisplayUrl(trump, 480)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/500px-Donald_Trump_official_portrait.jpg'
    );

    const buffett =
      'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg';
    expect(portraitDisplayUrl(buffett, 320)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Warren_Buffett_KU_Visit.jpg/500px-Warren_Buffett_KU_Visit.jpg'
    );

    const wood =
      'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg';
    expect(portraitDisplayUrl(wood, 256)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Cathie_Wood_ARK_Invest_Photo.jpg/500px-Cathie_Wood_ARK_Invest_Photo.jpg'
    );

    const ackman =
      'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg';
    expect(portraitDisplayUrl(ackman, 480)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg/500px-Bill_Ackman_%2826410186110%29_%28cropped%29.jpg'
    );
  });

  it('re-snaps invalid existing thumb sizes', () => {
    const bad =
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/480px-Donald_Trump_official_portrait.jpg';
    expect(portraitDisplayUrl(bad, 480)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/500px-Donald_Trump_official_portrait.jpg'
    );
  });

  it('leaves congress photos unchanged', () => {
    const congress =
      'https://unitedstates.github.io/images/congress/225x275/P000197.jpg';
    expect(portraitDisplayUrl(congress, 320)).toBe(congress);
  });
});
