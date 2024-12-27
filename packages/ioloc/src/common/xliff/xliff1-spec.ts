import { Text, XmlSpace, YesNo } from './xliff-spec.js';

export interface Xliff1Element {
  type: 'element';
  name: string;
  attributes?: { [key: string]: string | number | undefined };
  elements?: (Xliff1Element | Xliff1Text)[];
}

export type Xliff1Text = Text;

export interface Xliff1Doc<
  FileOther extends Xliff1Element | never = never,
  GroupOther extends Xliff1Element | never = never,
  UnitOther extends Xliff1Element | never = never,
> {
  declaration?: {
    attributes?: Record<string, string | number>;
  };
  elements: [Xliff1<FileOther, GroupOther, UnitOther>];
  name?: never;
}

export interface Xliff1<
  FileOther extends Xliff1Element | never = never,
  GroupOther extends Xliff1Element | never = never,
  UnitOther extends Xliff1Element | never = never,
> extends Xliff1Element {
  name: 'xliff';
  attributes: {
    /**
     * XLIFF Version - is used to specify the Version of the XLIFF Document.
     * This corresponds to the Version number of the XLIFF specification
     * that the XLIFF Document adheres to.
     */
    version: string;

    'xml:lang'?: string;

    // /**
    //  * How white spaces (ASCII spaces, tabs and line-breaks) are to be treated.
    //  *
    //  * Default: `default`
    //  */
    // 'xml:space'?: XmlSpace
    // xmlns?: 'urn:oasis:names:tc:xliff:document:2.0'
    // 'xmlns:fs'?: 'urn:oasis:names:tc:xliff:fs:2.0'
    // 'xmlns:gls'?: 'urn:oasis:names:tc:xliff:glossary:2.0'
    // 'xmlns:mda'?: 'urn:oasis:names:tc:xliff:metadata:2.0'
    // 'xmlns:mtc'?: 'urn:oasis:names:tc:xliff:matches:2.0'
    // 'xmlns:res'?: 'urn:oasis:names:tc:xliff:resourcedata:2.0'
    // 'xmlns:slr'?: 'urn:oasis:names:tc:xliff:sizerestriction:2.0'
    // 'xmlns:val'?: 'urn:oasis:names:tc:xliff:validation:2.0'
    [key: string]: string | number | undefined;
    //'xmlns:mf'?: 'http://www.unicode.org/ns/2021/messageformat/2.0/not-real-yet';
  };
  elements: Xliff1File<FileOther, GroupOther, UnitOther>[];
}

export interface Xliff1File<
  FileOther extends Xliff1Element | never = never,
  GroupOther extends Xliff1Element | never = never,
  UnitOther extends Xliff1Element | never = never,
> extends Xliff1Element {
  name: 'file';
  attributes: {
    // Required attributes
    original: string;
    'source-language': string;
    datatype: string;

    // Optional attributes
    tool?: string;
    'tool-id'?: string;
    date?: string;
    'xml:space'?: XmlSpace;
    ts?: string;
    category?: string;
    'target-language'?: string;
    'product-name'?: string;
    'product-version'?: string;
    'build-num'?: string;

    // Additional non-XLIFF attributes
    [key: string]: string | number | undefined;
  };
  elements:
    | [Xliff1Header, Xliff1Body<FileOther, GroupOther, UnitOther>]
    | [Xliff1Body<FileOther, GroupOther, UnitOther>];
}

export interface Xliff1Header extends Xliff1Element {
  name: 'header';
  attributes: {};
  elements: (
    | Xliff1Skl
    | Xliff1PhaseGroup
    | Xliff1Glossary
    | Xliff1Reference
    | Xliff1CountGroup
    | Xliff1PropGroup
    | Xliff1Note
    | Xliff1Tool
    | Xliff1Element
  )[];
}

export interface Xliff1Skl extends Xliff1Element {
  name: 'skl';
  attributes: {};
  elements: [Xliff1InternalFile | Xliff1ExternalFile];
}

export interface Xliff1InternalFile extends Xliff1Element {
  name: 'internal-file';
  attributes: {
    /**
     * The MIME type of the embedded file.
     */
    form?: string;

    /**
     * A CRC value for verifying the authenticity of the file.
     */
    crc?: string;
  };
  // Contents: An embedded file (represented as text in this structure)
  elements: any;
}

export interface Xliff1ExternalFile extends Xliff1Element {
  name: 'external-file';
  attributes: {
    /**
     * URI to the external file.
     */
    href: string;

    /**
     * A unique identifier for the file.
     */
    uid?: string;

    /**
     * A CRC value for verifying the authenticity of the file.
     */
    crc?: string;
  };
  // The external-file is an empty element, so no child elements are expected
  elements: never[];
}

export interface Xliff1PhaseGroup extends Xliff1Element {
  name: 'phase-group';
  attributes: {};
  // Contains one or more <phase> elements
  elements: Xliff1Phase[];
}

export interface Xliff1Phase extends Xliff1Element {
  name: 'phase';
  attributes: {
    /**
     * Uniquely identifies the phase.
     */
    'phase-name': string;

    /**
     * Identifies the kind of process the phase corresponds to.
     */
    'process-name': string;

    // Optional attributes
    'company-name'?: string;
    tool?: string;
    'tool-id'?: string;
    date?: string;
    'job-id'?: string;
    'contact-name'?: string;
    'contact-email'?: string;
    'contact-phone'?: string;
  };
  // Contains zero, one, or more <note> elements
  elements: Xliff1Note[];
}

export interface Xliff1Note extends Xliff1Element {
  name: 'note';
  attributes: {
    /**
     * Specifies the language of the note content.
     */
    'xml:lang'?: string;

    /**
     * Indicates who entered the note.
     */
    from?: string;

    /**
     * Allows assigning a priority from 1 (high) to 10 (low) to the note.
     */
    priority?: number;

    /**
     * Indicates if the note is a general note or pertains specifically to the <source> or the <target>.
     */
    annotates?: 'general' | 'source' | 'target';
  };
  // Contains text content, no standard child elements
  elements: Xliff1Text[];
}

export interface Xliff1Glossary extends Xliff1Element {
  name: 'glossary';
  attributes: {};
  // Contains a description (text content) and either one <internal-file> or one <external-file>
  elements: (Xliff1Text | Xliff1InternalFile | Xliff1ExternalFile)[];
}

export interface Xliff1Reference extends Xliff1Element {
  name: 'reference';
  attributes: {};
  // Contains a description (text content) and either one <internal-file> or one <external-file>
  elements: (Xliff1Text | Xliff1InternalFile | Xliff1ExternalFile)[];
}

export interface Xliff1CountGroup extends Xliff1Element {
  name: 'count-group';
  attributes: {
    /**
     * Uniquely identifies the count-group within the file.
     */
    name: string;
  };
  // Contains one or more <count> elements
  elements: Xliff1Count[];
}

export interface Xliff1Count extends Xliff1Element {
  name: 'count';
  attributes: {
    /**
     * Indicates what kind of count the element represents.
     */
    'count-type': string;

    /**
     * Indicates the unit of the count (default: word).
     */
    unit?: string;

    /**
     * References the phase in which the count was produced.
     */
    'phase-name'?: string;
  };
  // Contains the count value as text
  elements: Xliff1Text[];
}

export interface Xliff1PropGroup extends Xliff1Element {
  name: 'prop-group';
  attributes: {
    /**
     * Optional name for the prop-group.
     */
    name?: string;
  };
  // Contains one or more <prop> elements
  elements: Xliff1Prop[];
}

export interface Xliff1Prop extends Xliff1Element {
  name: 'prop';
  attributes: {
    /**
     * Identifies the type of property.
     */
    'prop-type': string;

    /**
     * Specifies the language of the property content.
     */
    'xml:lang'?: string;
  };
  // Contains tool-specific data or text
  elements: Xliff1Text[];
}

export interface Xliff1Tool extends Xliff1Element {
  name: 'tool';
  attributes: {
    /**
     * Uniquely identifies the tool.
     */
    'tool-id': string;

    /**
     * Specifies the name of the tool.
     */
    'tool-name': string;

    // Optional attributes
    'tool-version'?: string;
    'tool-company'?: string;

    // Additional non-XLIFF attributes
    [key: string]: string | number | undefined;
  };
  // Contains zero or more non-XLIFF elements
  elements: Xliff1Element[];
}

export interface Xliff1Body<
  FileOther extends Xliff1Element | never = never,
  GroupOther extends Xliff1Element | never = never,
  UnitOther extends Xliff1Element | never = never,
> extends Xliff1Element {
  name: 'body';
  attributes: {};
  // Contains zero or more <group>, <trans-unit>, <bin-unit> elements, in any order
  elements: (
    | Xliff1Group<GroupOther, UnitOther>
    | Xliff1TransUnit<UnitOther>
    | Xliff1BinUnit
    | FileOther
  )[];
}

export interface Xliff1Group<
  GroupOther extends Xliff1Element | never = never,
  UnitOther extends Xliff1Element | never = never,
> extends Xliff1Element {
  name: 'group';
  attributes: {
    id?: string;
    datatype?: string;
    'xml:space'?: string;
    // ... other optional attributes like ts, restype, etc.
    [key: string]: string | number | undefined;
  };
  // Contents include <context-group>, <count-group>, <prop-group>, <note>,
  // non-XLIFF elements, followed by <group>, <trans-unit>, <bin-unit> elements
  elements: (
    | Xliff1ContextGroup
    | Xliff1CountGroup
    | Xliff1PropGroup
    | Xliff1Note
    | GroupOther
    | Xliff1TransUnit<UnitOther>
    | Xliff1BinUnit
  )[];
}

export interface Xliff1TransUnit<
  UnitOther extends Xliff1Element | never = never,
> extends Xliff1Element {
  name: 'trans-unit';
  attributes: {
    id: string;
    approved?: YesNo;
    translate?: YesNo;
    reformat?: string;
    'xml:space'?: string;
    datatype?: string;
    // ... other optional attributes like phase-name, restype, etc.
    [key: string]: string | number | YesNo | undefined;
  };
  // Contents: <source>, <seg-source>, <target>, followed by <context-group>, <count-group>,
  // <prop-group>, <note>, <alt-trans>, and non-XLIFF elements
  elements: (
    | Xliff1Source
    | Xliff1SegSource
    | Xliff1Target
    | Xliff1ContextGroup
    | Xliff1CountGroup
    | Xliff1PropGroup
    | Xliff1Note
    | Xliff1AltTrans
    | UnitOther
  )[];
}

export interface Xliff1Source extends Xliff1Element {
  name: 'source';
  attributes: {
    'xml:lang'?: string;
    // ... other optional attributes like ts
    [key: string]: string | undefined;
  };
  // Contents: Text and optional inline elements like <g>, <x/>, <bx/>, <ex/>, <bpt>, etc.
  elements: (Xliff1Text | Xliff1InlineElement)[];
}

export interface Xliff1Target extends Xliff1Element {
  name: 'target';
  attributes: {
    state?: string;
    'state-qualifier'?: string;
    'phase-name'?: string;
    'xml:lang'?: string;
    // ... other optional attributes like coord, font, css-style, etc.
    [key: string]: string | undefined;
  };
  // Contents: Text and optional inline elements like <g>, <x/>, <bx/>, <ex/>, <bpt>, etc.
  elements: (Xliff1Text | Xliff1InlineElement)[];
}

// Define Xliff1InlineElement interface for inline elements like <g>, <x/>, <bx/>, etc.

export interface Xliff1AltTrans extends Xliff1Element {
  name: 'alt-trans';
  attributes: {
    mid?: string;
    'match-quality'?: string;
    'tool-id'?: string;
    crc?: string;
    'xml:lang'?: string;
    'xml:space'?: string;
    datatype?: string;
    // ... other optional attributes like restype, resname, etc.
    [key: string]: string | number | undefined;
  };
  // Contents: Zero or one <source>, zero or one <seg-source>, one <target>, followed by
  // <context-group>, <prop-group>, <note>, and non-XLIFF elements
  elements: (
    | Xliff1Source
    | Xliff1SegSource
    | Xliff1Target
    | Xliff1ContextGroup
    | Xliff1PropGroup
    | Xliff1Note
    | Xliff1Element
  )[];
}

export interface Xliff1BinUnit extends Xliff1Element {
  name: 'bin-unit';
  attributes: {
    id: string;
    'mime-type': string;
    // ... other optional attributes like approved, translate, etc.
    [key: string]: string | number | YesNo | undefined;
  };
  // Contents: <bin-source>, <bin-target>, followed by <context-group>, etc.
  elements: (
    | Xliff1BinSource
    | Xliff1BinTarget
    | Xliff1ContextGroup
    | Xliff1CountGroup
    | Xliff1PropGroup
    | Xliff1Note
    | Xliff1TransUnit
    | Xliff1Element
  )[];
}

export interface Xliff1BinSource extends Xliff1Element {
  name: 'bin-source';
  attributes: {
    // ... optional attributes like ts
    [key: string]: string | undefined;
  };
  // Contents: One of <internal-file> or <external-file>
  elements: (Xliff1InternalFile | Xliff1ExternalFile)[];
}

export interface Xliff1BinTarget extends Xliff1Element {
  name: 'bin-target';
  attributes: {
    'mime-type'?: string;
    // ... other optional attributes like state, phase-name, etc.
    [key: string]: string | undefined;
  };
  // Contents: One of <internal-file> or <external-file>
  elements: (Xliff1InternalFile | Xliff1ExternalFile)[];
}

export interface Xliff1SegSource extends Xliff1Element {
  name: 'seg-source';
  attributes: {
    'xml:lang'?: string;
    // ... other optional attributes like ts
    [key: string]: string | undefined;
  };
  // Contents: Text and optional inline elements like <g>, <x/>, <bx/>, <ex/>, <bpt>, etc.
  elements: (Xliff1Text | Xliff1InlineElement)[];
}

export interface Xliff1ContextGroup extends Xliff1Element {
  name: 'context-group';
  attributes: {
    crc?: string;
    name?: string;
    purpose?: string;
  };
  // Contains one or more <context> elements
  elements: Xliff1Context[];
}

export interface Xliff1Context extends Xliff1Element {
  name: 'context';
  attributes: {
    'context-type': string;
    'match-mandatory'?: YesNo;
    crc?: string;
  };
  // Contains text content
  elements: Xliff1Text[];
}

export type Xliff1InlineElement =
  | Xliff1GElement
  | Xliff1XElement
  | Xliff1BxElement
  | Xliff1ExElement
  | Xliff1PhElement
  | Xliff1BptElement
  | Xliff1EptElement
  | Xliff1ItElement
  | Xliff1SubElement
  | Xliff1MrkElement;

export interface Xliff1GElement extends Xliff1Element {
  name: 'g';
  attributes: {
    id: string;
    ctype?: string;
    clone?: YesNo;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Text and other inline elements
  elements: (Xliff1Text | Xliff1InlineElement)[];
}

export interface Xliff1XElement extends Xliff1Element {
  name: 'x';
  attributes: {
    id: string;
    ctype?: string;
    clone?: YesNo;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // The <x/> element is empty
  elements: never;
}

export interface Xliff1BxElement extends Xliff1Element {
  name: 'bx';
  attributes: {
    id: string;
    rid?: string;
    ctype?: string;
    clone?: YesNo;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | YesNo | undefined;
  };
  // The <bx/> element is empty
  elements: never;
}

export interface Xliff1ExElement extends Xliff1Element {
  name: 'ex';
  attributes: {
    id: string;
    rid?: string;
    clone?: YesNo;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | YesNo | undefined;
  };
  // The <ex/> element is empty
  elements: never;
}

export interface Xliff1PhElement extends Xliff1Element {
  name: 'ph';
  attributes: {
    id: string;
    ctype?: string;
    crc?: string;
    assoc?: 'before' | 'after';
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Code data and possibly <sub> elements
  elements: (Xliff1Text | Xliff1SubElement)[];
}

export interface Xliff1BptElement extends Xliff1Element {
  name: 'bpt';
  attributes: {
    id: string;
    rid?: string;
    ctype?: string;
    crc?: string;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Code data and possibly <sub> elements
  elements: (Xliff1Text | Xliff1SubElement)[];
}

export interface Xliff1EptElement extends Xliff1Element {
  name: 'ept';
  attributes: {
    id: string;
    rid?: string;
    crc?: string;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Code data and possibly <sub> elements
  elements: (Xliff1Text | Xliff1SubElement)[];
}

export interface Xliff1ItElement extends Xliff1Element {
  name: 'it';
  attributes: {
    id: string;
    pos: 'begin' | 'end';
    ctype?: string;
    crc?: string;
    xid?: string;
    'equiv-text'?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Code data and possibly <sub> elements
  elements: (Xliff1Text | Xliff1SubElement)[];
}

export interface Xliff1SubElement extends Xliff1Element {
  name: 'sub';
  attributes: {
    datatype?: string;
    ctype?: string;
    xid?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Text and optionally other inline elements
  elements: (Xliff1Text | Xliff1InlineElement)[];
}

export interface Xliff1MrkElement extends Xliff1Element {
  name: 'mrk';
  attributes: {
    mtype: string;
    mid?: string;
    comment?: string;
    // ... other non-XLIFF attributes
    [key: string]: string | undefined;
  };
  // Contents: Text and optionally other inline elements
  elements: (Xliff1Text | Xliff1InlineElement)[];
}
