"use client"

import Image from "next/image"
import { Book, Menu, Sunset, Trees, Zap } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Link from "next/link"

const Navbar1 = ({
  logo = {
    url: "/",
    src: "",
    alt: "logo",
    title: "Odito",
  },
  menu = [
    { title: "Home", url: "/" },
    {
      title: "Products",
      url: "#",
      items: [
        {
          title: "Blog",
          description: "The latest industry news, updates, and info",
          icon: <Book className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Company",
          description: "Our mission is to innovate and empower the world",
          icon: <Trees className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Careers",
          description: "Browse job listing and discover our workspace",
          icon: <Sunset className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Support",
          description:
            "Get in touch with our support team or visit our community forums",
          icon: <Zap className="size-5 shrink-0" />,
          url: "#",
        },
      ],
    },
    {
      title: "Resources",
      url: "#",
      items: [
        {
          title: "Help Center",
          description: "Get all the answers you need right here",
          icon: <Zap className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Contact Us",
          description: "We are here to help you with any questions you have",
          icon: <Sunset className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Status",
          description: "Check the current status of our services and APIs",
          icon: <Trees className="size-5 shrink-0" />,
          url: "#",
        },
        {
          title: "Terms of Service",
          description: "Our terms and conditions for using our services",
          icon: <Book className="size-5 shrink-0" />,
          url: "/terms",
        },
      ],
    },
    {
      title: "Pricing",
      url: "#pricing",
    },
    {
      title: "Blog",
      url: "#",
    },
  ],
  mobileExtraLinks = [
    { name: "Press", url: "#" },
    { name: "Contact", url: "#" },
    { name: "Imprint", url: "#" },
    { name: "Sitemap", url: "#" },
  ],
  auth = {
    login: { text: "Log in", url: "/login" },
    signup: { text: "Sign up", url: "/signup" },
  },
}) => {
  return (
    <section className="py-4 font-sans">
      <div className="container px-16">
        <nav className="hidden justify-between lg:flex">
          <div className="flex items-center gap-6">
            <Link href={logo.url} className="flex items-center gap-2">
              <Image 
                src="/logo/odito-logo-on-dark.png" 
                alt="Odito Logo" 
                width={1200}
                height={424}
                priority={true}
                className="h-12 w-auto hover:scale-105 transition-transform duration-200"
              />
            </Link>
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {menu.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/20 text-white hover:bg-white hover:text-black">
              <Link href={auth.login.url}>{auth.login.text}</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-black hover:bg-gray-200">
              <Link href={auth.signup.url}>{auth.signup.text}</Link>
            </Button>
          </div>
        </nav>
        <div className="block lg:hidden">
          <div className="flex items-center justify-between">
            <Link href={logo.url} className="flex items-center gap-2">
              <Image 
                src="/logo/odito-logo-on-dark.png" 
                alt="Odito Logo" 
                width={1200}
                height={424}
                priority={true}
                className="h-10 w-auto hover:scale-105 transition-transform duration-200"
              />
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="border-white/20 text-white hover:bg-white hover:text-black">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto bg-black border-white/10">
                <SheetHeader>
                  <SheetTitle>
                    <Link href={logo.url} className="flex items-center gap-2">
                      <Image 
                        src="/logo/odito-logo-on-dark.png" 
                        alt="Odito Logo" 
                        width={1200}
                        height={424}
                        priority={true}
                        className="h-10 w-auto hover:scale-105 transition-transform duration-200"
                      />
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <div className="my-6 flex flex-col gap-6">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex w-full flex-col gap-4"
                  >
                    {menu.map((item) => renderMobileMenuItem(item))}
                  </Accordion>
                  <div className="border-t border-white/10 py-4">
                    <div className="grid grid-cols-2 justify-start">
                      {mobileExtraLinks.map((link, idx) => (
                        <Link
                          key={idx}
                          className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors font-sans"
                          href={link.url}
                        >
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white hover:text-black">
                      <Link href={auth.login.url}>{auth.login.text}</Link>
                    </Button>
                    <Button asChild className="bg-white text-black hover:bg-gray-200">
                      <Link href={auth.signup.url}>{auth.signup.text}</Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  )
}

const renderMenuItem = (item) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title} className="text-white/70 font-sans">
        <NavigationMenuTrigger className="text-white/70 hover:text-white font-sans">{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="w-80 p-3 bg-black border border-white/10 rounded-lg">
            {item.items.map((subItem) => (
              <li key={subItem.title}>
                <NavigationMenuLink asChild>
                  <Link
                    className="flex select-none gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-white/10 hover:text-white text-white/70 font-sans"
                    href={subItem.url}
                  >
                    {subItem.icon}
                    <div>
                      <div className="text-sm font-semibold text-white font-sans">
                        {subItem.title}
                      </div>
                      {subItem.description && (
                        <p className="text-sm leading-snug text-white/50 font-sans">
                          {subItem.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    )
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink asChild>
        <Link
          className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white font-sans"
          href={item.url}
        >
          {item.title}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  )
}

const renderMobileMenuItem = (item) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="py-0 font-semibold hover:no-underline text-white font-sans">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <Link
              key={subItem.title}
              className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-white/10 hover:text-white text-white/70 font-sans"
              href={subItem.url}
            >
              {subItem.icon}
              <div>
                <div className="text-sm font-semibold text-white font-sans">{subItem.title}</div>
                {subItem.description && (
                  <p className="text-sm leading-snug text-white/50 font-sans">
                    {subItem.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <Link key={item.title} href={item.url} className="font-semibold text-white font-sans">
      {item.title}
    </Link>
  )
}

export { Navbar1 }
