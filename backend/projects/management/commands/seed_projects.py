"""A repeatable, intentionally fictional catalogue for the academic demo."""

from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from projects.models import Project
from projects.demo_data import DEMO_METADATA


PROJECTS = [
    {
        "title": "Nova Energy", "category": "Clean Energy", "funding_goal": "100000", "current_funding": "72500", "expected_return": "15", "duration": 12, "risk_level": "Medium", "featured": True,
        "short_description": "Bringing community-owned solar power to places ready for a brighter future.",
        "description": "Nova Energy imagines a cleaner way to power everyday life. This fictional initiative connects rooftop solar installations, shared battery storage and a community energy network across three neighbourhoods.\n\nThe concept gives residents a practical role in their energy future, with local maintenance teams and transparent usage reporting. Its staged rollout starts with public buildings before extending to homes and small businesses.\n\nThe simulation assumes a twelve-month project period. Equipment costs, installation timelines and seasonal generation illustrate why an expected return is an assumption, not a promise.",
        "objective": "Model a distributed solar network that makes reliable renewable energy more accessible to neighbourhoods.",
        "impact": "Fictional target: 320 households connected and 480 tonnes of annual carbon emissions avoided.",
    },
    {
        "title": "TerraGrid", "category": "Technology", "funding_goal": "240000", "current_funding": "139200", "expected_return": "18.5", "duration": 18, "risk_level": "High", "featured": True,
        "short_description": "Intelligent infrastructure that helps cities make every kilowatt count.",
        "description": "TerraGrid explores how software can make existing energy infrastructure work harder. A fictional network of sensors and forecasting tools helps building operators understand demand, spot waste and coordinate energy use.\n\nThe project begins with a pilot across a small district of offices and public buildings. The platform combines simple reporting with automated scheduling so that efficiency improvements are measurable.\n\nIts higher risk assumption reflects software development uncertainty, integration complexity and the challenge of securing adoption across multiple organisations.",
        "objective": "Demonstrate a connected energy-management platform for public buildings and small commercial districts.",
        "impact": "Fictional target: 45 buildings monitored and a 22% reduction in avoidable energy use.",
    },
    {
        "title": "AquaLoop", "category": "Water", "funding_goal": "85000", "current_funding": "66300", "expected_return": "10.5", "duration": 10, "risk_level": "Low", "featured": True,
        "short_description": "Turning everyday water waste into a resource communities can use again.",
        "description": "AquaLoop is a fictional water-reuse initiative built around compact filtration systems. It imagines capturing lightly used water from community facilities and preparing it for irrigation and other non-drinking uses.\n\nEach modular unit can be maintained locally, with sensors that make system performance easier to understand. The pilot pairs installation with practical education on responsible water use.\n\nThe lower risk label is a relative simulation assumption based on familiar technology. Maintenance needs, local uptake and operating costs still create uncertainty.",
        "objective": "Explore modular water reuse that reduces pressure on treated freshwater supplies.",
        "impact": "Fictional target: 1.8 million litres reused each year across 12 community sites.",
    },
    {
        "title": "MedNova Labs", "category": "Healthcare", "funding_goal": "320000", "current_funding": "137600", "expected_return": "21", "duration": 24, "risk_level": "High", "featured": False,
        "short_description": "Making early screening more accessible, one local clinic at a time.",
        "description": "MedNova Labs imagines a network of accessible diagnostic hubs serving communities with limited screening options. The fictional concept pairs compact testing equipment with secure coordination between clinics and laboratory teams.\n\nThe proposed pilot focuses on operational access: shorter sample journeys, clearer appointment information and better use of existing clinic capacity. It does not represent a medical service or claim proven health outcomes.\n\nA longer duration and higher assumed return illustrate the uncertainty of specialist equipment, validation requirements and healthcare operations.",
        "objective": "Model how a shared diagnostic network could improve access to routine screening infrastructure.",
        "impact": "Fictional target: six clinic partnerships and capacity for 9,000 annual screening appointments.",
    },
    {
        "title": "Harvest AI", "category": "Sustainable Agriculture", "funding_goal": "150000", "current_funding": "94500", "expected_return": "16.75", "duration": 15, "risk_level": "Medium", "featured": False,
        "short_description": "Helping small farms grow more thoughtfully with practical, data-informed tools.",
        "description": "Harvest AI explores an agricultural planning tool designed around the realities of smaller farms. This fictional project brings weather patterns, soil observations and irrigation schedules into one approachable interface.\n\nRather than replacing a farmer's judgement, the concept makes useful information easier to compare. A seasonal pilot would test the tools with a cooperative and refine the experience through regular field feedback.\n\nSeasonal variability, data quality and adoption influence the simulation's assumptions. The expected return is a simplified educational estimate for the full project period.",
        "objective": "Explore accessible planning tools for more efficient irrigation and crop management.",
        "impact": "Fictional target: 180 farms supported and 25% less irrigation water used in the pilot.",
    },
    {
        "title": "Solaris Communities", "category": "Clean Energy", "funding_goal": "180000", "current_funding": "165600", "expected_return": "12", "duration": 16, "risk_level": "Low", "featured": False,
        "short_description": "Shared solar spaces that put local people at the heart of cleaner energy.",
        "description": "Solaris Communities imagines shared solar gardens on underused land near residential areas. The fictional initiative brings generation, landscape improvements and educational spaces into a community-scale project.\n\nThe concept includes accessible maintenance paths, clear performance displays and training for local operators. Funding progress represents a curated scenario and does not change when a user saves a simulation.\n\nThe model uses established equipment and a staged installation plan, with weather, site preparation and ongoing maintenance represented by the relative risk assumption.",
        "objective": "Model community-scale solar generation with local participation and transparent reporting.",
        "impact": "Fictional target: two solar gardens with a combined 600 kW of planned capacity.",
    },
    {
        "title": "ClearWater Systems", "category": "Water", "funding_goal": "125000", "current_funding": "38750", "expected_return": "11.25", "duration": 14, "risk_level": "Medium", "featured": False,
        "short_description": "Quiet infrastructure with a clear purpose: more reliable community water access.",
        "description": "ClearWater Systems is a fictional infrastructure concept for modular water treatment and distribution monitoring. Its design combines familiar filtration processes with basic sensors that flag maintenance needs early.\n\nThe imagined first phase supports rural service hubs, with spare-part availability and operator training considered from the start. Public performance summaries would help communities understand how the system is working.\n\nInstallation logistics, maintenance capacity and changing source-water conditions are among the uncertainties represented in this educational scenario.",
        "objective": "Explore maintainable water infrastructure designed around long-term local operation.",
        "impact": "Fictional target: eight service hubs with combined daily treatment capacity of 40,000 litres.",
    },
    {
        "title": "EduBridge", "category": "Education", "funding_goal": "65000", "current_funding": "35750", "expected_return": "9", "duration": 9, "risk_level": "Low", "featured": False,
        "short_description": "Opening the door to practical learning, wherever a student starts.",
        "description": "EduBridge imagines an affordable digital learning toolkit for community study centres. The fictional platform combines downloadable lessons, shared devices and tools that help tutors follow each learner's progress.\n\nAn offline-friendly approach makes the concept useful where connectivity is intermittent. The pilot focuses on foundational digital skills and project-based learning, supported by a small network of trained facilitators.\n\nThe simulation uses a shorter project period and a modest expected return. Device upkeep, learner participation and content development remain uncertain.",
        "objective": "Model an accessible learning network that combines useful software with local mentorship.",
        "impact": "Fictional target: 1,200 learners reached through 20 community study centres.",
    },
    {
        "title": "GreenRoute", "category": "Infrastructure", "funding_goal": "210000", "current_funding": "142800", "expected_return": "14.5", "duration": 20, "risk_level": "Medium", "featured": False,
        "short_description": "Reimagining the last mile with cleaner, better-connected urban delivery.",
        "description": "GreenRoute is a fictional urban logistics project built around neighbourhood delivery hubs and electric cargo cycles. It explores how shorter local routes could reduce traffic pressure and make deliveries more predictable.\n\nThe proposed pilot links small retailers with shared consolidation points. Simple route planning and coordinated collection windows support the concept without requiring a large new transport network.\n\nFleet maintenance, retailer participation and route density influence the scenario. The return assumption is an educational estimate over the stated project duration.",
        "objective": "Explore a practical neighbourhood logistics network with a smaller operational footprint.",
        "impact": "Fictional target: 35 cargo cycles serving 90 independent retailers.",
    },
    {
        "title": "UrbanNest", "category": "Infrastructure", "funding_goal": "450000", "current_funding": "220500", "expected_return": "17.25", "duration": 30, "risk_level": "High", "featured": False,
        "short_description": "Thoughtful shared spaces that help neighbourhoods feel more connected.",
        "description": "UrbanNest imagines transforming underused buildings into flexible community workspaces. This fictional regeneration concept combines study areas, workshop facilities and small-business spaces with careful energy upgrades.\n\nThe phased approach starts with one building and a local participation programme. Adaptable interiors allow the space to evolve as community needs become clearer.\n\nRenovation costs, planning timelines and future occupancy make this a longer and higher-risk simulation. No property or financial interest is offered through Vestra.",
        "objective": "Model the reuse of existing buildings as adaptable, resource-conscious community spaces.",
        "impact": "Fictional target: 2,400 square metres revitalised with space for 60 local organisations.",
    },
]


class Command(BaseCommand):
    help = "Create or refresh 10 fictional Vestra projects, preserving existing project IDs."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError("Enable VEXTRA_DEMO_MODE=true before creating fictional demonstration projects.")
        created = 0
        for definition in PROJECTS:
            values = dict(definition)
            values.update(DEMO_METADATA[values["title"]], is_demo=True)
            values["slug"] = slugify(values["title"])
            for key in ("funding_goal", "current_funding", "expected_return"):
                values[key] = Decimal(values[key])
            project = Project.objects.filter(title__iexact=values["title"]).first()
            if project is None:
                Project.objects.create(**values)
                created += 1
            else:
                for field, value in values.items():
                    setattr(project, field, value)
                project.save()
        self.stdout.write(self.style.SUCCESS(
            f"Fictional catalogue ready: {created} created, {len(PROJECTS) - created} refreshed. "
            "For educational demonstration only."
        ))
