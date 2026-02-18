export const RNG = {
  // Return random float 0-1
  float() {
    return Math.random();
  },

  // Return random int min..max (inclusive)
  range(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // One-in-N chance
  chance(n) {
    return Math.random() < (1 / n);
  },

  // Pick item based on 'prob' field or even distribution
  pickWeighted(items) {
    // Calculate total weight
    let total = 0;
    for (const item of items) {
      total += (item.prob || 1);
    }

    const r = Math.random() * total;
    let sum = 0;

    for (const item of items) {
      sum += (item.prob || 1);
      if (r <= sum) return item;
    }

    return items[items.length - 1];
  }
};