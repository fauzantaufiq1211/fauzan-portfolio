-- Localize Core Creative Software (arsenal) competency icons to self-hosted /images/icons/ assets.
UPDATE public.competencies
SET icon_url = CASE name
  WHEN 'After Effects' THEN '/images/icons/after-effects.svg'
  WHEN 'Illustrator' THEN '/images/icons/illustrator.svg'
  WHEN 'InDesign' THEN '/images/icons/indesign.svg'
  WHEN 'Lightroom' THEN '/images/icons/lightroom.svg'
  WHEN 'Photoshop' THEN '/images/icons/photoshop.svg'
  WHEN 'Premiere Pro' THEN '/images/icons/premiere-pro.svg'
  WHEN 'Affinity' THEN '/images/icons/affinity.svg'
  WHEN 'Canva' THEN '/images/icons/canva.svg'
  WHEN 'Cavalry' THEN '/images/icons/cavalry.webp'
  WHEN 'CapCut' THEN '/images/icons/capcut.svg'
  WHEN 'Figma' THEN '/images/icons/figma.svg'
  ELSE icon_url
END
WHERE category = 'arsenal'
  AND name IN (
    'After Effects',
    'Illustrator',
    'InDesign',
    'Lightroom',
    'Photoshop',
    'Premiere Pro',
    'Affinity',
    'Canva',
    'Cavalry',
    'CapCut',
    'Figma'
  );
