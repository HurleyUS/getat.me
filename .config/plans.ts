const plans = {
  premium: {
    id: "cplan_34pOGvuXdApGqi7sL9jOGmt0NUu",
    name: "Premium",
    slug: "permium",
    price: {
      annual: "$3.99/mo",
      month: "$4.99/mo",
    },
  },
  pro: {
    id: "cplan_34pOGx8WQa1uJzZeE0Mc065iqTA",
    name: "Pro",
    slug: "pro",
    price: {
      annual: "$7.99/mo",
      month: "$9.99/mo",
    },
  },
  promax: {
    id: "cplan_34pOGuEbit1XihTIzD2b2t3i7jI",
    name: "ProMax",
    slug: "promax",
    price: {
      annual: "$14.99/mo",
      month: "$19.99/mo",
    },
  },
} as const;

export default plans;
