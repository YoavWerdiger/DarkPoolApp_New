import {
  applyQuiverPoliticianImages,
  resolveFeedPortraitUrl,
} from '../../screens/DarkPool/utils/feedPortrait';
import { looksLikePersonPhoto } from '../../screens/DarkPool/utils/investorPlaceholder';

describe('looksLikePersonPhoto', () => {
  it('rejects ticker logos and placeholders', () => {
    expect(looksLikePersonPhoto('https://cdn.brandfetch.io/nvda.com')).toBe(false);
    expect(looksLikePersonPhoto('https://logo.clearbit.com/aapl.com')).toBe(false);
    expect(looksLikePersonPhoto('https://storage.googleapis.com/uwassets/tickers/NVDA.png')).toBe(
      false
    );
    expect(looksLikePersonPhoto('https://storage.googleapis.com/uwassets/logos/AAPL.png')).toBe(
      false
    );
    expect(
      looksLikePersonPhoto(
        'https://xxx.supabase.co/storage/v1/object/public/backgrounds/transback.png'
      )
    ).toBe(false);
  });

  it('keeps congress, Quiver, wiki, and UW insider faces', () => {
    expect(
      looksLikePersonPhoto(
        'https://unitedstates.github.io/images/congress/225x275/P000197.jpg'
      )
    ).toBe(true);
    expect(
      looksLikePersonPhoto('https://assets.quiverquant.com/congress/P000197.jpg')
    ).toBe(true);
    expect(
      looksLikePersonPhoto(
        'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg'
      )
    ).toBe(true);
    expect(
      looksLikePersonPhoto('https://storage.googleapis.com/uwassets/insiders/12345')
    ).toBe(true);
  });
});

describe('resolveFeedPortraitUrl', () => {
  it('prefers a stored person photo over a guessed BioGuide URL', () => {
    const quiver = 'https://assets.quiverquant.com/congress/P000197.jpg';
    expect(
      resolveFeedPortraitUrl({
        storedUrl: quiver,
        personKind: 'politician',
        personId: 'P000197',
        personName: 'Nancy Pelosi',
      })
    ).toBe(quiver);
  });

  it('falls back to BioGuide congress photo when the stored URL is a ticker logo', () => {
    expect(
      resolveFeedPortraitUrl({
        storedUrl: 'https://storage.googleapis.com/uwassets/tickers/NVDA.png',
        personKind: 'politician',
        personId: 'P000197',
        personName: 'Nancy Pelosi',
      })
    ).toBe('https://unitedstates.github.io/images/congress/225x275/P000197.jpg');
  });

  it('never returns a ticker logo for an insider', () => {
    expect(
      resolveFeedPortraitUrl({
        storedUrl: 'https://logo.clearbit.com/tesla.com',
        personKind: 'insider',
        personId: 'TSLA:Elon Musk',
        personName: 'Elon Musk',
      })
    ).toBeNull();
  });

  it('keeps a UW insider face when it is not a ticker asset', () => {
    const face = 'https://storage.googleapis.com/uwassets/insiders/99';
    expect(
      resolveFeedPortraitUrl({
        storedUrl: face,
        personKind: 'insider',
        personId: 'TSLA:Elon Musk',
        personName: 'Elon Musk',
      })
    ).toBe(face);
  });
});

describe('applyQuiverPoliticianImages', () => {
  it('stamps Quiver ImageURL over a guessed github.io congress URL', () => {
    const quiver = 'https://assets.quiverquant.com/congress/P000197.jpg';
    const [row] = applyQuiverPoliticianImages(
      [
        {
          politician_id: 'P000197',
          politician_image_url:
            'https://unitedstates.github.io/images/congress/225x275/P000197.jpg',
        },
      ],
      [{ BioGuideID: 'P000197', ImageURL: quiver }]
    );
    expect(row.politician_image_url).toBe(quiver);
  });

  it('does not overwrite a curated wiki portrait', () => {
    const wiki =
      'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg';
    const [row] = applyQuiverPoliticianImages(
      [{ politician_id: 'P000197', politician_image_url: wiki }],
      [{ BioGuideID: 'P000197', ImageURL: 'https://assets.quiverquant.com/congress/P000197.jpg' }]
    );
    expect(row.politician_image_url).toBe(wiki);
  });

  it('refuses to stamp a ticker logo as a congress face', () => {
    const github =
      'https://unitedstates.github.io/images/congress/225x275/P000197.jpg';
    const [row] = applyQuiverPoliticianImages(
      [{ politician_id: 'P000197', politician_image_url: github }],
      [
        {
          BioGuideID: 'P000197',
          ImageURL: 'https://storage.googleapis.com/uwassets/tickers/NVDA.png',
        },
      ]
    );
    expect(row.politician_image_url).toBe(github);
  });
});
