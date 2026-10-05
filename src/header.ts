/**
 * The header tucks away while the visitor is in the empty aquarium-viewing stretch
 * (after the hero text has faded, before the Work section arrives) so the tank can be
 * enjoyed uninterrupted, and slides back in as soon as the Work section comes into view.
 */
const GAP_END_RATIO = 0.6; // header returns once the Work section's top passes 60% of the viewport height

export function shouldHideHeader(o: {
  heroHidden: boolean; // hero text has scrolled away
  workTop: number; // distance from the viewport top to the top of the Work section
  viewportH: number;
  menuOpen: boolean; // never hide the header while the mobile menu is open
}): boolean {
  if (o.menuOpen) return false;
  return o.heroHidden && o.workTop > o.viewportH * GAP_END_RATIO;
}
